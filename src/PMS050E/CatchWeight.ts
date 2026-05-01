import { M3API } from '@designedresults/h5-script-plus'
export class CatchWeight {
  private controller: IInstanceController
  private log: IScriptLog
  private facility: string
  private product: string
  private orderNumber: string

  constructor(scriptArgs: IScriptArgs) {
    this.controller = scriptArgs.controller
    this.log = scriptArgs.log
    if (scriptArgs.args.endsWith('!DEBUG')) {
      this.log.SetDebug()
    }
    this.facility = this.getFacility()
    this.product = this.getProduct()
    this.orderNumber = this.getOrderNumber()
  }

  public static Init(args: IScriptArgs): void {
    new CatchWeight(args).run()
  }

  private async run() {
    const { catchWeightUOM, basicUOM } = await this.getItem()
    const altUOM = await this.getItemAltUOMs()
    const { manufacturingUOM } = await this.getOrder()

    // copy manufactured quantity to catch weight quantity
    $(this.controller.ParentWindow)
      ?.find('#WHMAQA')
      ?.on('input', (e: any) => {
        const manufacturedQty = Number(e.target.value)
        let catchWeightQty = manufacturedQty
        if (manufacturingUOM !== catchWeightUOM) {
          catchWeightQty = this.convertUOM(basicUOM, altUOM, manufacturedQty, manufacturingUOM, catchWeightUOM) || 0
        }
        catchWeightQty = Math.abs(catchWeightQty)
        if (catchWeightQty && !isNaN(catchWeightQty)) {
          this.setCatchWeightQuantity(catchWeightQty.toString())
        } else {
          this.setCatchWeightQuantity('')
        }
      })
  }

  private getFacility() {
    const value = this.controller.GetValue('VHFACI')
    this.log.Debug(`Facility (VHFACI) = ${value}`)
    return value
  }

  private getProduct() {
    const value = this.controller.GetValue('WWPRNO')
    this.log.Debug(`Product (WWPRNO) = ${value}`)
    return value
  }

  private getOrderNumber() {
    const value = this.controller.GetValue('WWMFNO')
    this.log.Debug(`Order number (WWMFNO) = ${value}`)
    return value
  }

  private setCatchWeightQuantity(value: string) {
    this.log.Debug(`Setting catch weight (WWCAWE) = ${value}`)
    this.controller.SetValue('WWCAWE', value)
  }

  private async getItem() {
    const req: IMIRequest = {
      program: 'MMS200MI',
      transaction: 'GetItmBasic',
      record: {
        ITNO: this.product,
      },
      outputFields: ['BACD', 'UNMS', 'CWUN'],
    }
    const res = await M3API.executeRequest(req, "PMS050E_ItemBasic")
    this.log.Debug(JSON.stringify({ req, res }))
    return { lotNumberingMethod: res?.item?.BACD, basicUOM: res?.item?.UNMS, catchWeightUOM: res?.item?.CWUN }
  }

  private async getItemAltUOMs() {
    const req: IMIRequest = {
      program: 'MMS015MI',
      transaction: 'Lst',
      record: {
        ITNO: this.product,
        AUTP: '1', // 1-quantity
        NFTR: '2', // number of filters
      },
      outputFields: ['ALUN', 'COFA', 'DCCD'],
    }
    const res = await M3API.executeRequest(req, 'PMS050E_ItemAltUOM')
    this.log.Debug(JSON.stringify({ req, res }))
    const altUOM: AltUOM = {}
    res?.items?.forEach(item => {
      const uom = item.ALUN
      let factor = Number(item.COFA)
      let decimals = Number(item.DCCD)
      if (item.DMCF === '1') {
        // multiply
        factor = 1 / factor
      }
      altUOM[uom] = {
        factor,
        decimals,
      }
      this.log.Debug(`Alt UOM ${uom}, factor = ${factor}, decimals = ${decimals}`)
    })
    return altUOM
  }

  private convertUOM(basicUOM: string, altUOM: AltUOM, quantity: number, fromUOM: string, toUOM: string) {
    const from = altUOM[fromUOM].factor
    const to = altUOM[toUOM].factor
    let converted = 0
    if (fromUOM === basicUOM) {
      converted = quantity / to
    } else {
      const qtyBasicUOM = quantity * from
      converted = qtyBasicUOM / to
    }
    if (converted !== undefined) {
      const roundingFactor = Math.pow(10, altUOM[toUOM].decimals ?? 0)
      return Math.round(converted * roundingFactor) / roundingFactor
    }
  }

  private async getOrder() {
    const req: IMIRequest = {
      program: 'PMS100MI',
      transaction: 'Get',
      record: {
        FACI: this.facility,
        PRNO: this.product,
        MFNO: this.orderNumber,
      },
      outputFields: ['MAUN'],
    }
    const res = await M3API.executeRequest(req, "PMS050E_MO")
    this.log.Debug(JSON.stringify({ req, res }))
    return { manufacturingUOM: res?.item?.MAUN }
  }
}

module.exports = CatchWeight

type AltUOM = {
  [key: string]: { factor: number; decimals: number }
}
