import { ActionButton, BulkM3API, CSRF, H5Dialog, M3API } from '@designedresults/h5-script-plus'
import dayjs from 'dayjs'
import Dialog from '../Dialog'

class ReclassKilns {
  private controller: IInstanceController

  private top = 7
  private left = 70

  private warehouse: string
  private location: string
  private hours = 0

  private button: ActionButton
  private datetime: string = dayjs().format('YYYY-MM-DDTHH:mm')
  private idsDataGrid: any
  private selectedRows: any[] = []
  private bulkM3API: BulkM3API

  constructor(scriptArgs: IScriptArgs) {
    this.controller = scriptArgs.controller
    this.idsDataGrid = this.controller.GetGrid()['idsDataGrid']
    this.bulkM3API = new BulkM3API(new CSRF())
  }

  public static Init(args: IScriptArgs): void {
    new ReclassKilns(args).run()
  }

  private async run() {
    const sortingOrder = this.controller.GetSortingOrder()

    this.warehouse = this.getWarehouse()
    this.location = this.getLocation()

    if (sortingOrder === '45') {
      if (this.location === 'RD LUMBER') {
        this.addSetReclassDatetime()
        const handleSelectionChanged = () => {
          this.selectedRows = this.controller.GetGrid().getSelectedGridRows()
          if (this.selectedRows.length) {
            this.button.enable()
          } else {
            this.button.disable()
          }
        }
        this.idsDataGrid?.offEvent('selectionchanged', handleSelectionChanged)
        this.idsDataGrid?.addEventListener('selectionchanged', handleSelectionChanged)
      }

    }
  }

  private getWarehouse() {
    const location = this.controller.GetValue('W1OBKV')
    return location
  }
  private getLocation() {
    let location = this.controller.GetValue('WFSLCT')
    return location
  }

  private addSetReclassDatetime() {

    this.button = new ActionButton(this.controller)
      .name('reclass-datetime')
      .value('SET RECLASS DATE/TIME')
      .position(this.top + 2, this.left)
      .action(async () => {
        try {

          if (!this.selectedRows.length) {
            throw 'Select at least one row to update.'
          }

          for (const row of this.selectedRows) {
            if (row.data.MLSTAS !== '1' || row.data.Z1A930 !== 'STOPPED') {
              throw 'Select only rows where the current status is 1 and Kiln Status is STOPPED.'
            }
          }

          const inputId = Math.floor(Math.random() * 16777215).toString(16)
          const msg = `
            <p>Set date and time for the selected lots be reclassed on.</p>
            <div>
              <input type="datetime-local" id="${inputId}" value="${this.datetime}" />
            </div>
            <p></p>
            `
          const resp = new H5Dialog('Set Reclass Date/time', msg).withCancel().show()
          $('#' + inputId).on('change', (e: any) => {
            this.datetime = e.target.value
          })
          const ok = await resp
          if (ok) {
            await this.updateReclassDateTime()
            new Dialog('Set Reclass Date/time', 'Reclass date/time updated.').show()
            this.controller.PressKey('F5')
          }
        } catch (err) {
          new Dialog('Set Reclass Date/time', `<pre style="text-wrap-mode: wrap">${JSON.stringify(err, null, 2)}</pre>`).error().show()
        }
      })
      .build()

    this.button.disable()


  }

  private async getAltItem() {
    for (const row of this.selectedRows) {
      const req: IMIRequest = {
        program: 'MMS020MI',
        transaction: 'LstItemRelation',
        record: {
          ITNO: row.data.MLITNO
        }
      }
      const resp = await M3API.executeRequest(req)
      row.ALIT = resp?.item['ALIT']
    }
  }


  private async updateReclassDateTime() {
    await this.getAltItem()

    const d = dayjs(this.datetime, 'YYYYMMDDTHH:mm')
    const readable = d.format('ddd M/D h:mmA')
    const time = d.format('YYYYMMDDHHmmss')

    const requests: IMIRequest[] = this.selectedRows.map(r => ({
      program: 'CUSEXTMI',
      transaction: 'ChgFieldValue',
      record: {
        FILE: 'MILOMA',
        PK01: r.ALIT,
        PK02: r.data.MLBANO,
        A230: readable,
        A530: time
      }
    }))

    const resp = await this.bulkM3API.executeRequest(requests)
    if (resp.nrOfFailedTransactions) {
      console.error(resp)
      throw resp
    }
  }



}

module.exports = ReclassKilns
