import { formatErrorMessage, H5Dialog, M3API } from '@designedresults/h5-script-plus'
import dayjs from 'dayjs'
import numeral from 'numeral'
export class LotNumber {
  private controller: IInstanceController
  private log: IScriptLog
  private facility: string
  private product: string
  private orderNumber: string
  private override: boolean = false

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
    new LotNumber(args).run()
  }

  private async run() {

    this.watchQuantities()

    const { lotNumberingMethod } = await this.getItem()

    if (lotNumberingMethod === '0') {
      // 0-Manual
      this.controller.Requesting.Clear()
      this.controller.RequestCompleted.Clear()
      const detachRequestCompleted = this.controller.RequestCompleted.On((args: RequestEventArgs) => {
        this.log.Debug(`RequestCompleted event command type = ${args.commandType}`)
        this.log.Debug(`RequestCompleted event command value = ${args.commandValue}`)
        if (this.controller.Response.ControlData.message) {
          // request completed with a message
          this.log.Debug('Retrieveing WHBANO from instance cache')
          const lotNumber: string = InstanceCache.Get(this.controller, 'WHBANO') ?? ''
          this.setLotNumber(lotNumber)
        } else {
          // request completed successfully
          this.log.Debug('Removing instance cache value WHBANO')
          InstanceCache.Remove(this.controller, 'WHBANO')
        }
        this.log.Debug('Detaching RequestCompleted event handler')
        detachRequestCompleted()
      })

      
      // 0-manual
      if (this.getReceivedQuantity() > 0 && this.getManufacturedQuantity() > 0) {
        this.disableLotNumber()
        const savedLotNumber: string = InstanceCache.Get(this.controller, 'WHBANO') ?? ''
        this.setLotNumber(savedLotNumber)
      }
      this.attachRequesting()
    }
  }

  private attachRequesting() {
    this.log.Debug('Attaching Requesting event handler')
    const detachRequesting = this.controller.Requesting.On((args: CancelRequestEventArgs) => {
      this.onRequesting(args)
      this.log.Debug('Detaching Requesting event handler')
      detachRequesting()
    })
  }

  private onRequesting(args: CancelRequestEventArgs) {
    this.log.Debug(`Requesting event command type = ${args.commandType}`)
    this.log.Debug(`Requesting event command value = ${args.commandValue}`)
    if (args.commandValue === 'ENTER') {
      // update lot number and re-enter
      if (this.getManufacturedQuantity() > 0 || this.getReceivedQuantity() > 0) {
        const lotNumber: string = InstanceCache.Get(this.controller, 'WHBANO') ?? ''
        if (lotNumber) {
          this.setLotNumber(lotNumber)
          args.cancel = false
        } else {
          this.retrieveNextLotNumber()
          args.cancel = true
        }
      } else if (this.getManufacturedQuantity() < 0 || this.getReceivedQuantity() < 0) {
        // save lot number to reverse
        const lotNumber = this.getLotNumber()
        InstanceCache.Add(this.controller, 'WHBANO', lotNumber)
      }
    }
    this.attachRequesting()
  }

  private watchQuantities() {
    const receivedQty = $(this.controller.ParentWindow).find('#WHREQA')[0] as HTMLInputElement
    $(receivedQty).on('change', () => {
      if (this.getReceivedQuantity() < 0) {
        this.enableLotNumber()
      } else {
        this.disableLotNumber()
      }
    })
    const manufacturedQty = $(this.controller.ParentWindow).find('#WHMAQA')[0] as HTMLInputElement
    $(manufacturedQty).on('change', () => {
      if (this.getManufacturedQuantity() < 0) {
        this.enableLotNumber()
      } else {
        this.disableLotNumber()
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

  private getReceivedQuantity() {
    const value = this.controller.GetValue('WHREQA')
    this.log.Debug(`Received quantity (WHREQA) = ${value}`)
    return numeral(value).value() ?? 0
  }

  private getManufacturedQuantity() {
    const value = this.controller.GetValue('WHMAQA')
    this.log.Debug(`Manufactured quantity (WHMAQA) = ${value}`)
    return numeral(value).value() ?? 0
  }

  private disableLotNumber() {
    const lotNumberEl = $(this.controller.ParentWindow).find('#WHBANO')[0]
    $(lotNumberEl).attr('readonly', 'readonly')
    $(lotNumberEl).siblings('span.h5-lookup-trigger').hide()
  }

  private enableLotNumber() {
    const lotNumberEl = $(this.controller.ParentWindow).find('#WHBANO')[0]
    $(lotNumberEl).removeAttr('readonly')
    $(lotNumberEl).siblings('span.h5-lookup-trigger').show()
  }

  private getLotNumber() {
    const value = this.controller.GetValue('WHBANO')
    this.log.Debug(`Lot number (WHBANO) = ${value}`)
    return value
  }

  private setLotNumber(lotNumber: string) {
    this.log.Debug(`Setting lot number (WHBANO) = ${lotNumber}`)
    this.controller.SetValue('WHBANO', lotNumber)
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

  private async retrieveNextLotNumber() {
    this.controller.ShowBusyIndicator()
    try {
      const lotNumber = await this.getNextLotNumber()
      this.log.Debug(`Adding lot number WHBANO=${lotNumber} to instance cache`)
      InstanceCache.Add(this.controller, 'WHBANO', lotNumber)
      this.controller.PressKey('ENTER')
    } catch (err) {
      new H5Dialog('Populate lot number', formatErrorMessage(err)).show()
    }
    this.controller.HideBusyIndicator()
  }

  private async getNextLotNumber() {
    const parentOrderNumber = await this.getParentOrderNumber()
    let orderNumber = this.orderNumber
    if (parentOrderNumber) {
      orderNumber = parentOrderNumber
    }
    const lastPlanningArea = await this.getLastPlanningArea(orderNumber)
    const date = dayjs().format('YYMMDD')
    const lotSequence = await this.getLotSequence()
    return `${lastPlanningArea}${date}${lotSequence}`
  }

  private async getParentOrderNumber() {
    const req: IMIRequest = {
      program: 'EXPORTMI',
      transaction: 'Select',
      record: {
        QERY: `VHMFHL from MWOHED where VHFACI = ${this.facility} and VHPRNO = ${this.product} and VHMFNO = ${this.orderNumber}`,
      },
    }
    const res = await M3API.executeRequest(req)
    this.log.Debug(JSON.stringify({ req, res }))
    let parentOrderNumber = res?.item?.REPL
    this.log.Debug(`Parent order number = ${parentOrderNumber}`)
    return parentOrderNumber
  }

  private async getLastPlanningArea(orderNumber: string) {
    const req: IMIRequest = {
      program: 'EXPORTMI',
      transaction: 'Select',
      record: {
        QERY: `VOREAR from MWOOPE where VOFACI = ${this.facility} and VOMFNO = ${orderNumber}`,
      },
    }
    const res = await M3API.executeRequest(req)
    this.log.Debug(JSON.stringify({ req, res }))
    const last = res.items?.slice(-1)?.at(0)
    const lastPlanningArea = last?.REPL
    this.log.Debug(`Last planning area = ${lastPlanningArea}`)
    if (!lastPlanningArea) {
      throw Error('Unable to retrieve planning area from last operation.')
    }
    return lastPlanningArea
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

module.exports = LotNumber
