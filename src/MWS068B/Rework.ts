import {
  ActionButton,
  formatErrorMessage,
  getFieldValue,
  IMIBulkResponse,
  M3API,
  ScriptAuth
} from '@designedresults/h5-script-plus';
import Dialog from '../Dialog';
import numeral from 'numeral';


/**
 * Adjust qty for reworked beam
 * 
 * @M3API MMS310MI/Update
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
 * 
 * Example arg string: `TOP,10,LEFT,40,VIEW,ADJ01,LBL,Rework Tag`
 * 
 * 
 */
export class Rework {
  private controller: IInstanceController

  private top: number
  private left: number;
  private view?: string;
  private sort?: string;
  private label: string;
  private maxRows: number;

  private button?: ActionButton
  private idsDataGrid: any
  private selectedRows?: any[] = []


  public static Init(args: IScriptArgs): void {
    new Rework(args).run()
  }

  constructor(scriptArgs: IScriptArgs) {
    this.controller = scriptArgs.controller

    this.idsDataGrid = this.controller.GetGrid()['idsDataGrid']
  
    
    const arr = scriptArgs.args.split(',');
    this.top = Number(this.getArg(arr, 'TOP')) || 9
    this.left = Number(this.getArg(arr, 'LEFT')) || 10
    this.view = this.getArg(arr, 'VIEW')
    this.sort = this.getArg(arr, 'SORT')
    this.label = this.getArg(arr, 'LBL') || 'Rework'
    this.maxRows = Number(this.getArg(arr, 'MAX')) || 1
    

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
        if (this.selectedRows.length !== 1 || this.selectedRows?.at(0)?.data?.MLSTAS !== '1') {
          this.button?.disable()
        } else {
          this.button?.enable()
        }
      }

      this.idsDataGrid?.offEvent('selectionchanged', handleSelectionChanged)
      this.idsDataGrid?.addEventListener('selectionchanged', handleSelectionChanged)
    }


  }

  protected addUI() {

    this.button = new ActionButton(this.controller)
      .name('btn-Rework')
      .value(this.label)
      .position(this.top, this.left)
      .action(async () => {
        try {
          await this.process()
        } catch (error) {
          new Dialog().title(this.label).message(formatErrorMessage(error)).type('Alert').show()
        }
      })
      .build()
    this.button.disable()
  }

  protected async process() {
    const balIds = this.getBalIds()
    if (balIds.length === 0) {
      throw "Select a lot"
    }

    if (balIds.length > this.maxRows) {
      throw `Select between 1 and ${this.maxRows} lots`
    }

    const balId = balIds[0]

    if (await this.confirm(balId)) {
      const pieces = Number(window.sessionStorage.getItem("input-rework-pieces"))
      const reasonCode = window.sessionStorage.getItem("select-rework-reason-code")
      if (!reasonCode) {
        await new Dialog().title(this.label).message(`Reason code is required`).type('Error').show()

      } else if (pieces > 10) {
        await new Dialog().title(this.label).message(`Final pieces of ${pieces} is too large`).type('Error').show()

      } else if (balId.STQT > pieces) {
        await new Dialog().title(this.label).message(`Final pieces should be more than original ${numeral(balId.STQT).format()} pieces`).type('Error').show()

      } else if (balId.STQT < pieces) {

        await this.adjust(balId, pieces, reasonCode)
        const msg = `Lot ${balId.BANO} adjusted to ${numeral(pieces).format()} pieces with reason code ${reasonCode}`
        await new Dialog().title(this.label).message(msg).type('Success').show()


      } else {
        await new Dialog().title(this.label).message("No quantity adjustment required").type('Error').show()

      }
      this.controller.PressKey('F5')
    }

  }


  protected async confirm(balId: any) {
    const reasonCodes = await this.getReasonCodes()

    let options = ''
    reasonCodes?.forEach(reasonCode => {
      options += `<option value="${reasonCode.value}">${reasonCode.label}</option>`
    })

    let message = ``

    message += `
    <script>
      window.sessionStorage.removeItem("input-rework-pieces")
      window.sessionStorage.removeItem("select-rework-reason-code")
    </script>
    <style>
      #tbl-rework-confirm td {
        height: 2em;
        verical-algin: middle;
      }
      #tbl-rework-confirm input[type=number] {
        text-align: right;
      }
      #tbl-rework-confirm select {
        -webkit-appearance: none;
      background-color: #ffffff;
      border: 1px solid #525257;
      border-collapse: separate;
      border-radius: 2px;
      color: #000000;
      display: inline-block;
      font-size: 1.6rem;
      height: 3.8rem;
      max-width: 100%;
      padding: 0 12px;
      resize: none;
      text-align: left;
      width: 12em;
      -webkit-transition: border 300ms ease 0s, box-shadow 300ms ease 0s;
      -moz-transition: border 300ms ease 0s, box-shadow 300ms ease 0s;
      -o-transition: border 300ms ease 0s, box-shadow 300ms ease 0s;
      -ms-transition: border 300ms ease 0s, box-shadow 300ms ease 0s;
      transition: border 300ms ease 0s, box-shadow 300ms ease 0s;
      -moz-osx-font-smoothing: grayscale;
      -webkit-font-smoothing: antialiased;
      }
    </style>
    <table id="tbl-rework-confirm" style="border-collapse:collapse; border-spacing:0; margin-top:10px; width: 600px">
      <tbody>
        <tr>
          <td>Rework Item</td>
          <td>${balId.ITNO}</td>
        </tr>
        <tr>
          <td>Rework Lot</td>
          <td>${balId.BANO}</td>
        </tr>
        <!--
        <tr>
          <td style="width: 300px">
            <input id="rework-item-1" placeholder="Output item 1" style="width: 250px"/>
          </td>
          <td>
            <input type="number" id="rework-qty-1" style="width: 4em"/>
          </td>
        </td>
        <tr>
          <td style="width: 300px">
            <input id="rework-item-2" placeholder="Output item 2" style="width: 250px"/>
          </td>
          <td style="width: 300px">
            <input type="number" id="rework-qty-2" style="width: 4em"/>
          </td>
        </td>
        <tr>
          <td>
            <input id="rework-item-3" placeholder="Output item 3" style="width: 250px"/>
          </td>
          <td>
            <input type="number" id="rework-qty-3" style="width: 4em"/>
          </td>
        </td>
        -->
        <tr>
          <td>
            <label for="input-rework-pieces">Total Finished Pieces</label>
          </td>
          <td>
            <input 
              id="input-rework-pieces" 
              type="number" 
              step="1" 
              min="${balId.STQT}"
              style="width: 4em"
              value="${balId.STQT}"
             />
          </td>
          <td>
            <select id="select-rework-reason-code">
              <option value="" selected="selected">Select reason code</option>
              ${options}
            </select>
          </td>
        </tr>
      </tbody>
    </table>
    <script>
      $('#input-rework-pieces').on('input', (e) => {
        window.sessionStorage.setItem("input-rework-pieces", e.target.value)
      })
      $('#select-rework-reason-code').on('change', (e) => {
        window.sessionStorage.setItem("select-rework-reason-code", e.target.value)
      })
    </script>
    `

    const respPromise = new Dialog().title(this.label).message(message).type('Question').withCancel().show()

    // $('input[id^=rework-qty]').on('input', () => {
    //   let qty = 0
    //   $('input[id^=rework-qty]').each((i, el) => qty += Number($(el).val()))
    //   $('#input-rework-pieces').val(qty)
    // })
    // new AutocompleteInput($('#rework-item-1'), this.searchItem, () => {
    //   $('#rework-qty-1').focus()
    // })
    // new AutocompleteInput($('#rework-item-2'), this.searchItem, () => {
    //   $('#rework-qty-2').focus()
    // })
    // new AutocompleteInput($('#rework-item-3'), this.searchItem, () => {
    //   $('#rework-qty-3').focus()
    // })

    return await respPromise
  }

  // protected async searchItem(searchTerm: string) {
  //   const req: IMIRequest = {
  //     program: 'MMS200MI',
  //     transaction: 'SearchItem',
  //     record: {
  //       SQRY: `ITNO:*${searchTerm}* STAT:20 ITTY:FB*`
  //     },
  //     outputFields: ['ITNO'],
  //     maxReturnedRecords: 15
  //   }
  //   const res = await M3API.executeRequest(req, `autocomplete-${searchTerm}`)
  //   const searchResults = res.items?.map(item => ({ value: item.ITNO, label: item.ITNO }))
  //   return searchResults || []
  // }

  protected async getReasonCodes() {
    const res = await M3API.executeRequest({
      program: 'EXPORTMI',
      transaction: 'Select',
      record: {
        'SEPC': ',',
        'QERY': `CTSTKY, CTTX40 from CSYTAB where CTDIVI = '' and CTSTCO = 'RSCD' and CTSTKY >= 'B' and CTSTKY < 'C'`
      }
    })
    const reasonCodes = res.items?.map(item => {
      const row = item.REPL.split(',')
      return { value: row[0], label: `${row[0]} - ${row[1]}`}
    })
    return reasonCodes
  }

  protected getBalIds() {
    const balIds: any[] = []
    if (!this.selectedRows) {
      throw new Error('No rows selected')
    }
    for (const row of this.selectedRows) {
      const WHLO = getFieldValue(this.controller, 'MLWHLO', row)
      const ITNO = getFieldValue(this.controller, 'MLITNO', row)
      const WHSL = getFieldValue(this.controller, 'MLWHSL', row)
      const BANO = getFieldValue(this.controller, 'MLBANO', row)
      const STAS = getFieldValue(this.controller, 'MLSTAS', row)
      const STQT = getFieldValue(this.controller, 'MLSTQT', row)

      if (!(WHLO && ITNO && WHSL && BANO)) {
        throw new Error('Missing required field')
      }
      if (WHLO === '*') {
        throw new Error("Warehouse should not be aggregated")
      }
      if (WHSL === '*') {
        throw new Error("Location should not be aggregated")
      }
      if (ITNO === '*') {
        throw new Error("Item number should not be aggregated")
      }
      if (BANO === '*') {
        throw new Error("Lot number should not be aggregated")
      }
      if (STAS !== '1') {
        throw new Error("Lot must be in status 1")
      }

      balIds.push({ WHLO, ITNO, WHSL, BANO, STAS, STQT })
    }
    return balIds
  }

  protected async adjust(balId: any, pieces: number, reasonCode: string) {
    const req: IMIRequest = {
      program: 'MMS310MI',
      transaction: 'Update',
      record: {
        STQI: pieces,
        STAG: 2,
        ALOC: 1,
        RSCD: reasonCode,
        ...balId
      }
    }
    return await M3API.executeRequest(req)
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

module.exports = Rework
