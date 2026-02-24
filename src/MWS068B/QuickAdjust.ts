import {
  ActionButton,
  BulkM3API,
  CSRF,
  formatErrorMessage,
  getFieldValue,
  IMIBulkResponse,
  ScriptAuth
} from '@designedresults/h5-script-plus';
import numeral from 'numeral';
import Dialog from '../Dialog';


/**
 * Quickly adjust off selected inventory
 * 
 * @M3API MMS850MI/AddAdjust
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
 * |`LBL`|Adjust off|Label to use for the button text (optional)|
 * |`CFM`|Are you sure you want to adjust off?|Confirm message to show before executing api (optional)|
 * |`MAX`|1|Maximum number of rows to select (optional)|
 * |`RSCD`|ADJ|Reason code to use for adjustment (optional)|
 * 
 * Example arg string: `TOP,10,LEFT,40,VIEW,ADJ01,LBL,Adjust off,MAX,5`
 * 
 * Button added to position 10, 40 with label "Adjust off".  Only allowed if selected view is "ADJ01".  Up to 5 rows can be selected at a time.
 * 
 * 
 */
class QuickAdjust {
  private controller: IInstanceController
  private user: any;

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
    new QuickAdjust(args).run()
  }

  constructor(scriptArgs: IScriptArgs) {
    this.controller = scriptArgs.controller

    this.idsDataGrid = this.controller.GetGrid()['idsDataGrid']
    this.bulkM3API = new BulkM3API(new CSRF())
    this.user = ScriptUtil.GetUserContext().CurrentUser
    const arr = scriptArgs.args.split(',');
    this.top = Number(this.getArg(arr, 'TOP')) ?? 9
    this.left = Number(this.getArg(arr, 'LEFT')) ?? 10
    this.view = this.getArg(arr, 'VIEW')
    this.sort = this.getArg(arr, 'SORT')
    this.label = this.getArg(arr, 'LBL') ?? 'Quick Adjust'
    this.confirmMessage = this.getArg(arr, 'CFM') ?? 'Are you sure you want to adjust off this inventory?'
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
        if (this.selectedRows.length === 0) {
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
      .name('btn-QuickAdjust')
      .value(this.label)
      .position(this.top, this.left)
      .action(async () => {
        try {
          await this.adjust()
        } catch (error) {
          new Dialog().title(this.label).message(formatErrorMessage(error)).type('Alert').show()
        }
      })
      .build()
    this.button.disable()
  }

  protected async adjust() {
    const balIds = this.getBalIds()
    if (balIds.length === 0) {
      throw "Select a lot to adjust"
    }
    if (balIds.length > this.maxRows) {
      throw `Select up to ${this.maxRows} lot${this.maxRows > 1 ? 's' : ''} to adjust`
    }


    if (await this.confirm(balIds)) {
      const resp = await this.addAdjust(balIds)
      const html = this.formatResponse(resp)
      await new Dialog().title(this.label).message(html).type('Success').show()
      this.controller.PressKey('F5')
    }

  }

  protected async confirm(balIds: any[]) {
    let message = `<p>${this.confirmMessage}</p>`
    if (this.reasonCode) {
      message += `<p>Reason Code: <b>${this.reasonCode}</b>`
    }
    message += ``
    message += `
    <table style="border-collapse:collapse; border-spacing:0; margin-top:10px;">
      <thead>
      <tr style="border-bottom: 1px solid #000000; font-weight: bold; text-align:left;">
        <th>Whs</th>
        <th>Loc</th>
        <th>Item</th>
        <th>Lot</th>
        <th style="text-align:right; padding-right: 10px;">Qty</th>
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
      <td style="white-space: nowrap; padding-right: 10px; text-align:right">${numeral(balId.STQT).format()}</td>
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

      if (!(WHLO && ITNO && WHSL && BANO && STQT)) {
        throw new Error('Missing required field to peform Quick Adjust')
      }
      if (WHLO === '*') {
        throw new Error("Warehouse should not be aggregated to perform Quick Adjust")
      }
      if (WHSL === '*') {
        throw new Error("Location should not be aggregated to perform Quick Adjust")
      }
      if (ITNO === '*') {
        throw new Error("Item number should not be aggregated to perform Quick Adjust")
      }
      if (BANO === '*') {
        throw new Error("Lot number should not be aggregated to perform Quick Adjust")
      }


      balIds.push({ WHLO, ITNO, WHSL, BANO, STQT: numeral(STQT).value() })
    }
    return balIds
  }

  protected async addAdjust(balIds) {
    const reqs: IMIRequest[] = balIds.map(balId => ({
      program: 'MMS850MI',
      transaction: 'AddAdjust',
      record: {
        PRFL: '*EXE',
        E0PA: 'WS',
        E065: 'WMS',
        RSCD: this.reasonCode,
        QLQT: numeral(balId.STQT).value() * -1,
        RESP: this.user,
        STAG: '2',
        ...balId
      },
      includeMetadata: true,
    }))
    return await this.bulkM3API.executeRequest(reqs)
  }

  protected formatResponse(resp: IMIBulkResponse) {
    formatErrorMessages(resp)
    let html = ''
    if (resp.nrOfFailedTransactions === 0) {
      html += '<h3>Inventory adjustment completed successfully.</h3>'
    } else {
      html += '<h3>Inventory adjustment did not complete successfully.  Review errors below.</h3>'
    }
    html += '<table style="border-collapse:collapse; border-spacing:0; margin-top:10px;">'
    html += `
    <thead>
    <tr style="border-bottom:1px solid black; font-weight:bold; text-align:left">
      <td>Whs</td>
      <td>Loc</td>
      <td>Item</td>
      <td>Lot</td>
      <th style="text-align:right; padding-right: 10px;">Qty</th>
      <td></td>
    </tr>
    </thead>
    <tbody>
    `
    for (const result of resp.results) {
      const { WHLO, ITNO, WHSL, BANO, STQT } = result.parameters
      html += `
      <tr>
        <td style="white-space: nowrap; padding-right: 10px;">${WHLO}</td>
        <td style="white-space: nowrap; padding-right: 10px;">${WHSL}</td>
        <td style="white-space: nowrap; padding-right: 10px;">${ITNO}</td>
        <td style="white-space: nowrap; padding-right: 10px;">${BANO}</td>
        <td style="white-space: nowrap; padding-right: 10px;">${STQT}</td>
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

module.exports = QuickAdjust
