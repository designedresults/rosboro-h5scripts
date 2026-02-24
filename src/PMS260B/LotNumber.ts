import { ActionButton, formatErrorMessage, H5Dialog, M3API } from '@designedresults/h5-script-plus'
import dayjs from 'dayjs'
import numeral from 'numeral'
class PMS260B_LotNumber {
  private controller: IInstanceController
  private log: IScriptLog
  private product: string
  private btn: ActionButton

  constructor(scriptArgs: IScriptArgs) {
    this.controller = scriptArgs.controller
    this.log = scriptArgs.log
    if (scriptArgs.args.endsWith('!DEBUG')) {
      this.log.SetDebug()
    }

    // WWWHLO,WS1,WWPRNO,KS1X2KDFKST50.5,WWSTRT,001,WWORQT,1000,WWMAUN,UN,WHWHSL,KS OUTFEED!DEBUG
    const defaults = this.parseArgString(scriptArgs.args)

    if (!this.getProduct()) {
      this.setWarehouse(defaults.WWWHLO)
      this.setProduct(defaults.WWPRNO)
      this.setStructureType(defaults.WWSTRT)
      this.setLocation(defaults.WHWHSL)
      this.controller.PressKey('ENTER')
    }
    if (!this.getQuantity()) {
      this.setQuantity(defaults.WWORQT)
      this.setManufacturingUm(defaults.WWMAUN)
    }

    this.product = this.getProduct()

  }

  private parseArgString(argString: string) {
    const defaults: any = {}
    const argSplit = argString.split('!')
    if (argSplit[0]) {
      const defaultArgs = argSplit[0].split(',')
      for (let i = 0; i < defaultArgs.length; i++) {
        if (i % 2 === 0) {
          defaults[defaultArgs[i]] = defaultArgs[i + 1]
        }
      }
    }
    return defaults
  }

  public static Init(args: IScriptArgs): void {
    new PMS260B_LotNumber(args).run()
  }

  private async run() {
    const { lotNumberingMethod } = await this.getItem()

    if (lotNumberingMethod === '0') { // 0-Manual lot number
      
      if (this.getQuantity() && this.getLotNumber()) {
        this.addButton()
      }

      if (this.getQuantity() && !this.getLotNumber()) {
        this.controller.ShowBusyIndicator()
        try {
          const lotNumber = await this.getNextLotNumber()
          this.setLotNumber(lotNumber)
          this.controller.PressKey('ENTER')
        } catch (err) {
          new H5Dialog('Populate lot number', formatErrorMessage(err)).show()
        }
        this.controller.HideBusyIndicator()

      }
    }

  }

  private addButton() {
    this.btn = new ActionButton(this.controller)
      .name('btn-confirm-transaction')
      .value('F14 Confirm Transaction')
      .position(7, 76)
      .action(async () => {
        this.controller.ShowBusyIndicator()
        this.controller.PressKey('F14')
      })
      .build()
  }


  private setWarehouse(value: string) {
    if (value) {
      this.log.Debug(`Set Warehouse (WWWHLO) = ${value}`)
      this.controller.SetValue('WWWHLO', value)
    }
  }

  private setProduct(value: string) {
    if (value) {
      this.log.Debug(`Set Product (WWPRNO) = ${value}`)
      this.controller.SetValue('WWPRNO', value)
    }
  }

  private setStructureType(value: string) {
    if (value) {
      this.log.Debug(`Set Structure Type (WWSTRT) = ${value}`)
      this.controller.SetValue('WWSTRT', value)
    }
  }

  private setQuantity(value: string) {
    if (value) {
      this.log.Debug(`Set Quantity (WWORQT) = ${value}`)
      this.controller.SetValue('WWORQT', value)
    }
  }

  private setManufacturingUm(value: string) {
    if (value) {
      this.log.Debug(`Set Manufacturing UM (WWMAUN) = ${value}`)
      this.controller.SetValue('WWMAUN', value)
    }
  }

  private setLocation(value: string) {
    if (value) {
      this.log.Debug(`Set Location (WHWHSL) = ${value}`)
      this.controller.SetValue('WHWHSL', value)
    }
  }

  private getProduct(): string {
    const value = this.controller.GetValue('WWPRNO')
    this.log.Debug(`Product (WWPRNO) = ${value}`)
    return value
  }

  private getQuantity() {
    const value = this.controller.GetValue('WWORQT')
    this.log.Debug(`Quantity (WWORQT) = ${value}`)
    return numeral(value).value() ?? 0
  }

  private disableLotNumber() {
    const lotNumberEl = $(this.controller.ParentWindow).find('#WHBANO')[0]
    $(lotNumberEl).attr('readonly', 'readonly')
    $(lotNumberEl).siblings('span.h5-lookup-trigger').remove()
  }

  private setLotNumber(lotNumber: string) {
    this.log.Debug(`Setting lot number (WHBANO) = ${lotNumber}`)
    this.controller.SetValue('WHBANO', lotNumber)
  }

  private getLotNumber() {
    const lotNumber = this.controller.GetValue('WHBANO')
    this.log.Debug(`Get Lot number (WHBANO) = ${lotNumber}`)
    return lotNumber
  }

  private async getItem() {
    const req: IMIRequest = {
      program: 'MMS200MI',
      transaction: 'GetItmBasic',
      record: {
        ITNO: this.product,
      },
      outputFields: ['BACD'],
    }
    const res = await M3API.executeRequest(req)
    this.log.Debug(JSON.stringify({ req, res }))
    return { lotNumberingMethod: res?.item?.BACD }
  }

  private async getNextLotNumber() {
    const planningArea = this.getPlanningAreaFromProduct()
    const date = dayjs().format('YYMMDD')
    const lotSequence = await this.getLotSequence()
    return `${planningArea}${date}${lotSequence}`
  }

  private getPlanningAreaFromProduct() {
    let planningArea = '';
    if (this.product?.length > 2) {
      planningArea = this.product.substring(0, 2)
      this.log.Debug(`Planning area ${planningArea} retrieved from product ${this.product}`)
    }
    if (!planningArea) {
      throw `Unable to retrieve planning area from product ${this.product}`
    }
    return planningArea;
  }


  private async getLotSequence() {
    const req: IMIRequest = {
      program: 'CRS165MI',
      transaction: 'RtvNextNumber',
      record: {
        NBTY: 'DS',
        NBID: 'A',
      },
    }
    const res = await M3API.executeRequest(req)
    this.log.Debug(JSON.stringify({ req, res }))
    const lotSequence = numeral(res.item?.NBNR).format('0000')
    this.log.Debug(`Next lot sequence = ${lotSequence}`)
    if (!lotSequence) {
      throw new Error('Unable to retrieve lot sequence.')
    }
    return lotSequence
  }
}

module.exports = PMS260B_LotNumber
