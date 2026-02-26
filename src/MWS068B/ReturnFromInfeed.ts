import {
  ActionButton,
  BulkM3API,
  ComboBox,
  CSRF,
  formatErrorMessage,
  getFieldValue,
  IMIBulkResponse,
  Label,
  M3API,
  NumberInput,
  ScriptAuth,
  TextInput
} from '@designedresults/h5-script-plus';
import Dialog from '../Dialog';
import numeral from 'numeral'


/**
 * Return from infeed
 * 
 * @M3API MMS060MI/PrtPutAwayLbl
 * 
 * @argument H5 Script Arugment
 * 
 * _Comma separated pairs of keys and values_
 * 
 * |Key|Ex. value|Notes|
 * |---|---|---|
 * |`TOP`|10|Top screen position to add button|
 * |`LEFT`|40|Left screen position to add button|
 * |`VIEW`|ADJ01|View required to show buttons (optional)|
 * |`SORT`|41|Sort required to show buttons (optional)|
 * |`LBL`|Reprint Tag|Label to use for the button text (optional)|
 * 
 * Example arg string: `TOP,10,LEFT,40,VIEW,ADJ01,LBL,Reprint Tag`
 * 
 * 
 */
class ReturnFromInfeed {
  private controller: IInstanceController
  private user: any;
  private division: string;

  private top: number
  private left: number;
  private view: string;
  private sort: string;
  private label: string;

  private confirmMessage: string;

  private quantity: NumberInput
  private newLotNumber: TextInput
  private toLocation: TextInput
  private button: ActionButton

  private idsDataGrid: any
  private selectedRows: any[]

  private bulkM3API: BulkM3API
  public static Init(args: IScriptArgs): void {
    new ReturnFromInfeed(args).run()
  }

  constructor(scriptArgs: IScriptArgs) {
    this.controller = scriptArgs.controller

    this.idsDataGrid = this.controller.GetGrid()['idsDataGrid']
    this.bulkM3API = new BulkM3API(new CSRF())
    this.user = ScriptUtil.GetUserContext().USID
    this.division = ScriptUtil.GetUserContext().CurrentDivision
    const arr = scriptArgs.args.split(',');
    this.top = Number(this.getArg(arr, 'TOP')) ?? 9
    this.left = Number(this.getArg(arr, 'LEFT')) ?? 10
    this.view = this.getArg(arr, 'VIEW')
    this.sort = this.getArg(arr, 'SORT')
    this.label = this.getArg(arr, 'LBL') ?? 'Return from infeed'
    this.confirmMessage = this.getArg(arr, 'CFM') ?? 'Are you sure you want to return this item from infeed?'

  }

  private getArg(arr: string[], arg: string) {
    const nameIdx = arr.indexOf(arg)
    if (nameIdx === -1) {
      return undefined
    }
    return arr[nameIdx + 1]
  }

  private async run() {
    let allowed = true;
    const auth = new ScriptAuth(this.controller)
    if (this.view) {
      allowed = auth.isView(this.view)
    }
    if (this.sort) {
      allowed = auth.isSort(this.sort)
    }


    if (allowed) {

      const location: string = this.controller.GetValue('W3OBKV')
      if (!location.endsWith('INFEED')) {
        return
      }

      this.addUI()

      const handleSelectionChanged = () => {
        this.selectedRows = this.controller.GetGrid().getSelectedGridRows()
        if (this.selectedRows.length !== 1) {
          this.button.disable()
          this.quantity.setString("")
        } else {
          this.button.enable()
          let qty = numeral(getFieldValue(this.controller, 'MLSTQT', this.selectedRows.at(0))).value()
          this.quantity.setNumber(qty)
        }
      }

      this.idsDataGrid?.offEvent('selectionchanged', handleSelectionChanged)
      this.idsDataGrid?.addEventListener('selectionchanged', handleSelectionChanged)
    }


  }

  protected addUI() {
    let left = this.left
    new Label(this.controller)
      .name('lbl-Quantity')
      .value('Qty')
      .position(this.top, left)
      .build()
    left += 2

    this.quantity = new NumberInput(this.controller)
      .name('txt-Quantity')
      .value('')
      .position(this.top, left)
      .width(6)
      .build()
    left += 6

    new Label(this.controller)
      .name('lbl-NewLotNumber')
      .value('New lot')
      .position(this.top, left)
      .build()
    left += 4

    this.newLotNumber = new TextInput(this.controller)
      .name('txt-NewLotNumber')
      .value('')
      .position(this.top, left)
      .build()
    left += 13

    new Label(this.controller)
      .name('lbl-ToLocation')
      .value('To loc')
      .position(this.top, left)
      .build()
    left += 3

    let defaultToLocation = '';
    if (SessionCache.ContainsKey('ReturnFromInfeed:toLocation')) {
      defaultToLocation = SessionCache.Get('ReturnFromInfeed:toLocation')
    }

    this.toLocation = new TextInput(this.controller)
      .name('txt-ToLocation')
      .value(defaultToLocation)
      .position(this.top, left)
      .width(10)
      .build()
    left += 12

    this.button = new ActionButton(this.controller)
      .name('btn-ReturnFromInfeed')
      .value(this.label)
      .position(this.top, left)
      .action(async () => {
        try {
          await this.returnFromInfeed()
        } catch (error) {
          new Dialog().title(this.label).message(formatErrorMessage(error)).type('Alert').show()
        }
      })
      .build()
    this.button.disable()


  }

  protected async returnFromInfeed() {
    const balIds = this.getBalIds()
    if (balIds.length !== 1) {
      throw "Select one item to return from infeed"
    }
    const balId = balIds[0];
    const itemNumber = balId.ITNO;
    const warehouse = balId.WHLO;
    const lotNumber = balId.BANO;

    
    const quantity = this.quantity.getNumber()
    const toLocation = this.toLocation.getString();
    SessionCache.Add("ReturnFromInfeed:toLocation", toLocation)
    
    const newLotNumber = this.newLotNumber.getString()
    if (lotNumber === newLotNumber) {
      throw 'New lot number must be different from the current lot number.'
    }

    this.validateQuantity(quantity, balIds[0])
    await this.validateNewLotnumber(itemNumber, newLotNumber)
    await this.validateToLocation(balIds[0].WHLO, toLocation)

    if (await this.confirm(balIds, quantity, toLocation, newLotNumber)) {
      let resp = await this.addMove(balIds, quantity, toLocation)
      if (resp.nrOfFailedTransactions === 0) {
        // only perform reclass if move was successful
        const respReclass = await this.addReclass(balIds, toLocation, newLotNumber)
        resp.nrOfFailedTransactions = respReclass.nrOfFailedTransactions
        resp.nrOfSuccessfullTransactions += respReclass.nrOfSuccessfullTransactions
        resp.results = [...resp.results, ...respReclass.results]

      }

      const html = this.formatResponse(resp)
      await new Dialog().title(this.label).message(html).type('Success').show()

      this.controller.PressKey('F5')
    }

  }

  protected async confirm(balIds: any[], quantity: number, toLocation: string, newLotNumber: string) {
    let message = `<p>${this.confirmMessage}</p>`
    message += `<p>Item will be moved to ${toLocation} and reclassfied to ${newLotNumber}.</p>`
    message += `
    <table style="border-collapse:collapse; border-spacing:0; margin-top:10px;">
      <thead>
      <tr style="border-bottom: 1px solid #000000; font-weight: bold; text-align:left;">
        <th>Whs</th>
        <th>Loc</th>
        <th>Item</th>
        <th>Lot</th>
        <th>Qty</th>
        <th>To loc</th>
        <th>New lot</th>
      </tr>
      </thead>
      <tbody>
      <tr>
    `
    for (const balId of balIds) {
      message += `
      <td style="white-space: nowrap; padding-right: 10px;">${balId.WHLO}</td>
      <td style="white-space: nowrap; padding-right: 10px;">${balId.WHSL}</td>
      <td style="white-space: nowrap; padding-right: 10px;">${balId.ITNO}</td>
      <td style="white-space: nowrap; padding-right: 10px;">${balId.BANO}</td>
      <td style="white-space: nowrap; padding-right: 5px; text-align: right">${numeral(quantity).format()}</td>
      <td style="white-space: nowrap; padding-right: 10px;">${toLocation}</td>
      <td style="white-space: nowrap; padding-right: 10px;">${newLotNumber}</td>
      `
    }
    message += '</tr></tbody></table>'
    return await new Dialog().title(this.label).message(message).type('Question').withCancel().show()
  }

  protected getBalIds() {
    const balIds: any[] = []
    for (const row of this.selectedRows) {
      const WHLO = getFieldValue(this.controller, 'MLWHLO', row)
      const ITNO = getFieldValue(this.controller, 'MLITNO', row)
      const WHSL = getFieldValue(this.controller, 'MLWHSL', row)
      const BANO = getFieldValue(this.controller, 'MLBANO', row)
      const STQT = getFieldValue(this.controller, 'MLSTQT', row)

      if (!(WHLO && ITNO && WHSL && BANO)) {
        throw new Error('Missing required field to Return From Infeed')
      }
      if (WHLO === '*') {
        throw new Error("Warehouse should not be aggregated to Return From Infeed")
      }
      if (WHSL === '*') {
        throw new Error("Location should not be aggregated to Return From Infeed")
      }
      if (ITNO === '*') {
        throw new Error("Item number should not be aggregated to Return From Infeed")
      }
      if (BANO === '*') {
        throw new Error("Lot number should not be aggregated to Return From Infeed")
      }
      if (isNaN(Number(numeral(STQT).value()))) {
        throw new Error("Cannot find on hand quantity")
      }

      balIds.push({ WHLO, ITNO, WHSL, BANO, STQT })
    }
    return balIds
  }

  protected validateQuantity(value: any, balId: any) {
    value = numeral(value).value()
    if (isNaN(Number(value))) {
      throw `Enter a valid quantity.`
    }
    if (value <= 0) {
      throw `Quantity to return must be greater than zero.`
    }

    const onHand = numeral(balId['STQT']).value()
    if (value > onHand) {
      throw `Cannot return more than ${numeral(onHand).format()}.`
    }

  }

  protected async validateNewLotnumber(itemNumber: string, lotNumber: string) {
    if (!lotNumber) {
      throw `New lot number is required.`
    }

    try {
      const req: IMIRequest = {
        program: 'MMS235MI',
        transaction: 'GetItmLot',
        record: {
          ITNO: itemNumber,
          BANO: lotNumber
        }
      }
      await M3API.executeRequest(req)
    } catch (err) {
      if (err.errorCode === 'WBA0403') {
        throw `Lot number ${lotNumber} for item ${itemNumber} does not exist.`
      } else {
        throw err
      }
    }
  }

  protected async validateToLocation(warehouse: string, toLocation: string) {
    if (!toLocation) {
      throw `To location is required.`
    }

    try {
      const req: IMIRequest = {
        program: 'MMS010MI',
        transaction: 'GetLocation',
        record: {
          WHLO: warehouse,
          WHSL: toLocation
        }
      }
      await M3API.executeRequest(req)
    } catch (err) {
      if (err.errorCode === 'WWS0103') {
        throw `Location ${toLocation} does not exist in warehouse ${warehouse}.`
      } else {
        throw err
      }
    }
  }

  protected async addMove(balIds: any[], quantity: number, toLocation: string) {
    try {
      const reqs: IMIRequest[] = balIds.map(balId => ({
        program: 'MMS850MI',
        transaction: 'AddMove',
        record: {
          PRFL: '*EXE',
          E0PA: 'WS',
          E065: 'WMS',
          WHLO: balId.WHLO,
          WHSL: balId.WHSL,
          ITNO: balId.ITNO,
          BANO: balId.BANO,
          QLQT: quantity,
          TWSL: toLocation
        },
        includeMetadata: true,
      }))
      return await this.bulkM3API.executeRequest(reqs)
    } catch (err) {
      return err
    }
  }


  protected async addReclass(balIds: any[], toLocation: string, newLotNumber: string) {
    try {
      const reqs: IMIRequest[] = balIds.map(balId => ({
        program: 'MMS850MI',
        transaction: 'AddReclass',
        record: {
          PRFL: '*EXE',
          E0PA: 'WS',
          E065: 'WMS',
          WHLO: balId.WHLO,
          WHSL: toLocation,
          ITNO: balId.ITNO,
          BANO: balId.BANO,
          NITN: balId.ITNO,
          NBAN: newLotNumber,
          ALOC: '1',
          STAS: '2'
        },
        includeMetadata: true,
      }))
      return await this.bulkM3API.executeRequest(reqs)
    } catch (err) {
      return err
    }
  }



  protected formatResponse(resp: IMIBulkResponse) {
    formatErrorMessages(resp)
    let html = ''
    if (resp.nrOfFailedTransactions === 0) {
      html += '<h3>Return From Infeed completed successfully.</h3>'
    } else {
      html += '<h3>Return From Infeed did not complete successfully.  Review errors below.</h3>'
    }
    html += '<table style="border-collapse:collapse; border-spacing:0; margin-top:10px;">'
    html += `
    <thead>
    <tr style="border-bottom:1px solid black; font-weight:bold; text-align:left">
      <td>Step</td>
      <td>Whs</td>
      <td>Loc</td>
      <td>Item</td>
      <td>Lot</td>
      <td></td>
    </tr>
    </thead>
    <tbody>
    `
    for (const result of resp.results) {
      const { WHLO, ITNO, WHSL, BANO } = result.parameters
      html += `
      <tr>
        <td style="white-space: nowrap; padding-right: 10px;">${result.transaction}</td>
        <td style="white-space: nowrap; padding-right: 10px;">${WHLO}</td>
        <td style="white-space: nowrap; padding-right: 10px;">${WHSL}</td>
        <td style="white-space: nowrap; padding-right: 10px;">${ITNO}</td>
        <td style="white-space: nowrap; padding-right: 10px;">${BANO}</td>
        <td style="color:red">${result?.errorMessage ?? ''}</td>
      </tr>
      `
    }
    html += '</tbody></table>'
    return html
  }
}


function formatErrorMessages(resp: IMIBulkResponse) {
  if (resp.nrOfFailedTransactions > 0) {
    resp.results.forEach(res => {
      if (res.errorCfg || res.errorCode || res.errorField || res.errorMessage || res.errorType) {
        // some error content set
        if (!res.errorMessage) {
          // no error message set
          let msg = []
          if (res.errorCfg?.trim()) {
            msg.push(`Cfg: ${res.errorCfg}`)
          }
          if (res.errorCode?.trim()) {
            msg.push(`Code: ${res.errorCode}`)
          }
          if (res.errorField?.trim()) {
            msg.push(`Field: ${res.errorField}`)
          }
          if (res.errorType?.trim()) {
            msg.push(`Type: ${res.errorType}`)
          }
          res.errorMessage = msg.join('; ')
        }
      }
    })
  }
}

module.exports = ReturnFromInfeed
