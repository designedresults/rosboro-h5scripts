import { M3API } from '@designedresults/h5-script-plus'
class PMS050E_CatchWeight {
  private controller: IInstanceController
  private log: IScriptLog
  private itemNumber: string

  constructor(scriptArgs: IScriptArgs) {
    this.controller = scriptArgs.controller
    this.log = scriptArgs.log
    if (scriptArgs.args.endsWith('!DEBUG')) {
      this.log.SetDebug()
    }
    this.itemNumber = this.getItemNumber()
  }

  public static Init(args: IScriptArgs): void {
    new PMS050E_CatchWeight(args).run()
  }

  private async run() {
    const { catchWeightUOM, basicUOM } = await this.getItem()
    const altUOM = await this.getItemAltUOMs()
    const purchaseUOM = this.getPurchaseUOM()


    // copy manufactured quantity to catch weight quantity
    $(this.controller.ParentWindow)
      ?.find('#WBRVQA')
      ?.on('input', (e: any) => {
        const purchasedQty = Number(e.target.value)
        let catchWeigthQty = purchasedQty
        if (purchaseUOM !== catchWeightUOM) {
          catchWeigthQty = this.convertUOM(basicUOM, altUOM, purchasedQty, purchaseUOM, catchWeightUOM)
        }
        this.setCatchWeightQuantity(catchWeigthQty.toString())
      })
  }

  private getPurchaseUOM() {
    const value = this.controller.GetValue('IBPUUN')
    this.log.Debug(`Purchase UOM (IBPUUN) = ${value}`)
    return value
  }

  private getItemNumber() {
    const value = this.controller.GetValue('IBITNO')
    this.log.Debug(`ItemNumber (IBITNO) = ${value}`)
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
        ITNO: this.itemNumber,
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
        ITNO: this.itemNumber,
        AUTP: '1', // 1-quantity
        NFTR: '2', // number of filters
      },
      outputFields: ['ALUN', 'COFA', 'DCCD'],
    }
    const res = await M3API.executeRequest(req, 'PPS300E_ItemAltUOM')
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
      converted = quantity * to
    } else {
      const qtyBasicUOM = quantity / from
      converted = qtyBasicUOM * to
    }
    if (converted !== undefined) {
      const roundingFactor = Math.pow(10, altUOM[toUOM].decimals ?? 0)
      return Math.round(converted * roundingFactor) / roundingFactor
    }
  }

}

module.exports = PMS050E_CatchWeight

type AltUOM = {
  [key: string]: { factor: number; decimals: number }
}
