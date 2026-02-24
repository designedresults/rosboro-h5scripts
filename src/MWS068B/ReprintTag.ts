import {
  ActionButton,
  BulkM3API,
  CSRF,
  formatErrorMessage,
  getFieldValue,
  IMIBulkResponse,
  M3API,
  ScriptAuth
} from '@designedresults/h5-script-plus';
import Dialog from '../Dialog';


/**
 * Reprint putaway tag
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
class ReprintTag {
  private controller: IInstanceController
  private user: any;
  private division: string;

  private reasonCode: string;

  private top: number
  private left: number;
  private view: string;
  private sort: string;
  private label: string;
  private maxRows: number;
  private confirmMessage: string;


  private button: ActionButton
  private idsDataGrid: any
  private selectedRows: any[]

  private bulkM3API: BulkM3API
  public static Init(args: IScriptArgs): void {
    new ReprintTag(args).run()
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
    this.label = this.getArg(arr, 'LBL') ?? 'Reprint Tag'
    this.confirmMessage = this.getArg(arr, 'CFM') ?? 'Are you sure you want to reprint tags?'
    this.maxRows = Number(this.getArg(arr, 'MAX')) ?? 1
    this.reasonCode = this.getArg(arr, 'RSCD')

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

      this.addUI()

      const handleSelectionChanged = () => {
        this.selectedRows = this.controller.GetGrid().getSelectedGridRows()
        if (this.selectedRows.length !== 1) {
          this.button.disable()
        } else {
          this.button.enable()
        }
      }

      this.idsDataGrid?.offEvent('selectionchanged', handleSelectionChanged)
      this.idsDataGrid?.addEventListener('selectionchanged', handleSelectionChanged)
    }


  }

  protected addUI() {

    this.button = new ActionButton(this.controller)
      .name('btn-ReprintTag')
      .value(this.label)
      .position(this.top, this.left)
      .action(async () => {
        try {
          await this.reprintTag()
        } catch (error) {
          new Dialog().title(this.label).message(formatErrorMessage(error)).type('Alert').show()
        }
      })
      .build()
    this.button.disable()
  }

  protected async reprintTag() {
    const balIds = this.getBalIds()
    if (balIds.length === 0) {
      throw "Select a lot to reprint tag"
    }

    if (balIds.length > this.maxRows) {
      throw `Select between 1 and ${this.maxRows} lot to reprint tag`
    }

    const printer = await this.getPrinter()

    if (await this.confirm(balIds, printer)) {
      const resp = await this.prtPutAwayLbl(balIds, printer)
      const html = this.formatResponse(resp)
      await new Dialog().title(this.label).message(html).type('Success').show()
      this.controller.PressKey('F5')
    }

  }

  protected async confirm(balIds: any[], printer: string) {
    let message = `<p>${this.confirmMessage}</p>`

    message += `Printer: <b>${printer}</b>`
    message += `
    <table style="border-collapse:collapse; border-spacing:0; margin-top:10px;">
      <thead>
      <tr style="border-bottom: 1px solid #000000; font-weight: bold; text-align:left;">
        <th>Whs</th>
        <th>Loc</th>
        <th>Item</th>
        <th>Lot</th>
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

      if (!(WHLO && ITNO && WHSL && BANO)) {
        throw new Error('Missing required field to Reprint Tag')
      }
      if (WHLO === '*') {
        throw new Error("Warehouse should not be aggregated to Reprint Tag")
      }
      if (WHSL === '*') {
        throw new Error("Location should not be aggregated to Reprint Tag")
      }
      if (ITNO === '*') {
        throw new Error("Item number should not be aggregated to Reprint Tag")
      }
      if (BANO === '*') {
        throw new Error("Lot number should not be aggregated to Reprint Tag")
      }


      balIds.push({ WHLO, ITNO, WHSL, BANO })
    }
    return balIds
  }

  protected async prtPutAwayLbl(balIds: any[], printer: string) {
    const reqs: IMIRequest[] = balIds.map(balId => ({
      program: 'MMS060MI',
      transaction: 'PrtPutAwayLbl',
      record: {
        DEV0: printer,
        COPY: 1,
        ...balId
      },
      includeMetadata: true,
    }))
    return await this.bulkM3API.executeRequest(reqs)
  }

  protected async getPrinter() {
    let printer: string = undefined

    const req: IMIRequest = {
      program: 'MNS205MI',
      transaction: 'Lst',
      record: {
        DIVI: this.division,
        USID: this.user,
        MEDC: '*PRT'
      }
    }

    const resp = await M3API.executeRequest(req)

    const putawayLabel = resp.items?.find(item => item['PRTF'] === 'MWS450PF')
    if (putawayLabel) {
      printer = putawayLabel['DEV1']
    } else {
      const blankPrintFile = resp.items?.find(item => item['PRTF'] === '' || item['PRTF'] === undefined)
      if (blankPrintFile) {
        printer = blankPrintFile['DEV1']
      }
    }

    if (!printer) {
      throw `No printer set for ${this.user} in MNS205.`
    }
    return printer
  }

  protected formatResponse(resp: IMIBulkResponse) {
    formatErrorMessages(resp)
    let html = ''
    if (resp.nrOfFailedTransactions === 0) {
      html += '<h3>Reprint tag completed successfully.</h3>'
    } else {
      html += '<h3>Reprint tag did not complete successfully.  Review errors below.</h3>'
    }
    html += '<table style="border-collapse:collapse; border-spacing:0; margin-top:10px;">'
    html += `
    <thead>
    <tr style="border-bottom:1px solid black; font-weight:bold; text-align:left">
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

module.exports = ReprintTag
