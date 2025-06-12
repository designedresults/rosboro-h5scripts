import numeral from 'numeral'
import {
  ActionButton,
  BulkM3API,
  CSRF,
  formatErrorMessage,
  getFieldValue,
  IMIBulkResponse,
  TextInput,
} from '@designedresults/h5-script-plus'
import Dialog from '../Dialog'

class QuickMove {
  private controller: IInstanceController

  private top: number = 9
  private left: number = 10

  private location: TextInput
  private button: ActionButton
  private idsDataGrid: any
  private selectedRows: any[]

  private bulkM3API: BulkM3API
  public static Init(args: IScriptArgs): void {
    new QuickMove(args).run()
  }

  constructor(scriptArgs: IScriptArgs) {
    this.controller = scriptArgs.controller
    this.idsDataGrid = this.controller.GetGrid()['idsDataGrid']
    this.bulkM3API = new BulkM3API(new CSRF())
  }

  private async run() {
    this.addUI()

    this.idsDataGrid?.removeAllListeners('selectionchanged')
    this.idsDataGrid?.addEventListener('selectionchanged', () => {
      this.selectedRows = this.controller.GetGrid().getSelectedGridRows()
      if (this.selectedRows.length === 0) {
        this.button.disable()
      } else {
        this.button.enable()
      }
    })
  }

  protected addUI() {
    this.location = new TextInput(this.controller)
      .name('txt-Location')
      .value('')
      .position(this.top, this.left)
      .width(10)
      .build()
    

    this.button = new ActionButton(this.controller)
      .name('btn-QuickMove')
      .value('Quick Move')
      .position(this.top, this.left + 10)
      .action(async () => {
        try {
          await this.move()
        } catch (error) {
          new Dialog().title('Quick Move').message(formatErrorMessage(error)).type('Alert').show()
        }
      })
      .build()
    this.button.disable()
  }

  protected async move() {
    const balIds = this.getBalIds()
    const resp = await this.moveBaldIds(balIds)
    console.log(resp)
    const html = this.formatResponse(resp)
    await new Dialog().title('Quick Move').message(html).type('Success').show()
    this.controller.PressKey('F5')

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
        throw new Error('Missing required field to peform Quick Move')
      }
      balIds.push({ WHLO, ITNO, WHSL, BANO, TRQT: numeral(STQT).value()})
    }
    return balIds
  }

  protected async moveBaldIds(balIds: any[]) {
    const toLocation = this.location.getString()
    const reqs: IMIRequest[] = balIds.map(balId => ({
      program: 'MMS175MI',
      transaction: 'Update',
      record: {TWSL: toLocation.toUpperCase(), DSP1: '1', ...balId},
      includeMetadata: true
    }))
    return await this.bulkM3API.executeRequest(reqs)
  }

  protected formatResponse(resp: IMIBulkResponse) {
    let html = ''
    html += `<h3>Move to ${this.location.getString().toUpperCase()}</h3>`
    html += '<table cellspacing="0" cellpadding="0">'
    html += `
    <thead>
    <tr>
      <td style="border-bottom:1px solid black; font-weight:bold">Whs</td>
      <td style="border-bottom:1px solid black; font-weight:bold">Item</td>
      <td style="border-bottom:1px solid black; font-weight:bold">Loc</td>
      <td style="border-bottom:1px solid black; font-weight:bold">Lot</td>
      <td style="border-bottom:1px solid black; font-weight:bold"></td>
    </tr>
    </thead>
    <tbody>
    `
    for (const result of resp.results) {
      const {WHLO, ITNO, WHSL, BANO} = result.parameters
      html += `
      <tr>
        <td>${WHLO}</td>
        <td>${ITNO}</td>
        <td>${WHSL}</td>
        <td>${BANO}</td>
        <td style="color:red">${result?.errorMessage ?? ''}</td>
      </tr>
      `
    }
    html += '</tbody></table>'
    return html
  }
}

module.exports = QuickMove
