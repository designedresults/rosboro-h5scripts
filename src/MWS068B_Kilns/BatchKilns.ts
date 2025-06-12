import dayjs from 'dayjs'
import Dialog from '../Dialog'
import MBMInit, { IMBMInit } from '../MBMInit'

class BatchKilns {
  private controller: IInstanceController

  private top = 7
  private left = 70

  private warehouse: string
  private location: string
  private hours = 0

  constructor(scriptArgs: IScriptArgs) {
    this.controller = scriptArgs.controller
  }

  public static Init(args: IScriptArgs): void {
    new BatchKilns(args).run()
  }

  private async run() {
    const sortingOrder = this.controller.GetSortingOrder()

    this.warehouse = this.getWarehouse()
    this.location = this.getLocation()

    if (sortingOrder === '45') {
      const whsl = await this.getLocationDetails()
      const kiln = await this.getKilnDetails()
      if (kiln.type === 'BATCH_STAGE') {
        this.addHours(0, 120)
        this.addStartBatch(whsl)
      } else if (kiln.type === 'BATCH_WIP') {
          this.addHours(-12, 12)
          this.addUpdateBatch(whsl)
          this.addStopBatch(whsl)
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

  private addStartBatch(whsl: any) {
    const btn = new ButtonElement()
    btn.Position = new PositionElement()
    btn.Position.Top = this.top
    btn.Position.Left = this.left + 20
    btn.Name = 'start'
    btn.Value = 'START BATCH'
    const el = this.controller.GetContentElement().AddElement(btn)
    $(el).on('click', async () => {
      try {
        const msg = `
        <p>Batch for ${whsl.name} will be started for ${this.hours} hours planning to finish ${dayjs()
          .add(this.hours, 'hours')
          .format('ddd, M/D h:mma')}</p>
        <p>Are you sure you want to start this batch?</p>
        `
        const ok = await new Dialog('Start Batch Kiln', msg).withCancel().show()
        if (ok) {
          await this.startBatch(this.warehouse, this.location, this.hours)
          new Dialog('Start Batch Kiln', 'Start batch kiln job submitted').show()
        }
      } catch (err) {
        new Dialog('Start Batch Kiln', `<pre>${JSON.stringify(err, null, 2)}</pre>`).error().show()
      }
      this.controller.PressKey('F5')
    })
  }

  private addStopBatch(whsl: any) {
    const btn = new ButtonElement()
    btn.Position = new PositionElement()
    btn.Position.Top = this.top
    btn.Position.Left = this.left + 30
    btn.Name = 'start'
    btn.Value = 'STOP BATCH'
    const el = this.controller.GetContentElement().AddElement(btn)
    $(el).on('click', async () => {
      try {
        // await this.startBatch(this.warehouse, this.location)
        const msg = `
        <p>Batch for ${whsl.name} will be stopped with a planned release on ${dayjs()
          .add(16, 'hours')
          .format('ddd, M/D h:mma')}</p>
        <p>Are you sure you want to stop this batch?</p>
        `
        const ok = await new Dialog('Stop Batch Kiln', msg).withCancel().show()
        if (ok) {
          await this.stopBatch(this.warehouse, this.location)
          new Dialog('Start Batch Kiln', 'Stop batch kiln job submitted').show()
        }
      } catch (err) {
        new Dialog('Stop Batch Kiln', `<pre>${JSON.stringify(err)}</pre>`).error().show()
      }
      this.controller.PressKey('F5')
    })
  }

  private addUpdateBatch(whsl: any) {
    const btn = new ButtonElement()
    btn.Position = new PositionElement()
    btn.Position.Top = this.top
    btn.Position.Left = this.left + 15
    btn.Name = 'start'
    btn.Value = 'UPDATE BATCH'
    const el = this.controller.GetContentElement().AddElement(btn)
    $(el).on('click', async () => {
      try {
        // await this.startBatch(this.warehouse, this.location)
        const msg = `
        <p>Stop and release time for ${whsl.name} will be updated by ${this.hours} hours.</p>
        <p>Are you sure you want to update this batch?</p>
        `
        const ok = await new Dialog('Update Batch Kiln', msg).withCancel().show()
        if (ok) {
          await this.updateBatch(this.warehouse, this.location, this.hours)
          new Dialog('Update Batch Kiln', 'Update batch kiln job submitted').show()
        }
      } catch (err) {
        new Dialog('Update Batch Kiln', `<pre>${JSON.stringify(err)}</pre>`).error().show()
      }
      this.controller.PressKey('F5')
    })
  }

  private addHours(min: number, max: number) {
    const lbl: ILabelElement = new LabelElement()
    lbl.Position = new PositionElement()
    lbl.Position.Top = this.top
    lbl.Position.Left = this.left
    lbl.Name = 'lbl-Hours'
    lbl.Value = 'Hours' + (min < 0 ? ' (+/-)' : '')
    this.controller.GetContentElement().AddElement(lbl)

    const txt: ITextBoxElement = new TextBoxElement()
    txt.Position = new PositionElement()
    txt.Position.Top = this.top
    txt.Position.Left = this.left + 10
    txt.Position.Width = 4
    txt.Name = 'txt-Hours'
    txt.Value = ''
    txt.IsRightJustified = true
    const el = this.controller.GetContentElement().AddElement(txt)
    $(el).find('input').attr('type', 'number').attr('min', min).attr('max', max).attr('step', '1')
    $(el).on('input', (e: any) => {
      let num = Number(e.target.value)
      if (!isNaN(num)) {
        this.hours = Math.round(num)
      }
    })
  }

  protected async startBatch(warehouse: string, location: string, hours: number) {
    const mbm: IMBMInit = {
      documentNumber: 'MBM',
      mediaCtrl1: 'KILN',
      mediaCtrl2: 'START',
      printerFile: 'MBM',
      field: 'WHLO',
      documentIdentity: warehouse,
      messageKey4Field: 'WHSL',
      messageKey4Value: location,
      messageKey5Field: 'HOUR',
      messageKey5Value: hours.toString()
    }
    await MBMInit.sendMBM(mbm)
    return mbm
  }

  protected async stopBatch(warehouse: string, location: string) {
    const mbm: IMBMInit = {
      documentNumber: 'MBM',
      mediaCtrl1: 'KILN',
      mediaCtrl2: 'STOP',
      printerFile: 'MBM',
      field: 'WHLO',
      documentIdentity: warehouse,
      messageKey4Field: 'WHSL',
      messageKey4Value: location
    }
    await MBMInit.sendMBM(mbm)
    return mbm
  }

  protected async updateBatch(warehouse: string, location: string, hours: number) {
    const mbm: IMBMInit = {
      documentNumber: 'MBM',
      mediaCtrl1: 'KILN',
      mediaCtrl2: 'UPDATE',
      printerFile: 'MBM',
      field: 'WHLO',
      documentIdentity: warehouse,
      messageKey4Field: 'WHSL',
      messageKey4Value: location,
      messageKey5Field: 'HOUR',
      messageKey5Value: hours.toString()
    }
    await MBMInit.sendMBM(mbm)
    return mbm
  }

  protected async getLocationDetails() {
    const record = {
      WHLO: this.warehouse,
      WHSL: this.location,
    }
    const request: IMIRequest = {
      program: 'MMS010MI',
      transaction: 'GetLocation',
      record,
      outputFields: ['SLDS', 'SLTP'],
    }
    const resp = (await MIService.Current.executeRequest(request)) as IMIResponse
    const name = resp?.item?.SLDS
    const stockZone = resp?.item?.SLTP
    return { name, stockZone }
  }

  protected async getKilnDetails() {
    const record = {
      FILE: 'MITPCE',
      PK01: this.warehouse,
      PK02: this.location,
    }
    const request: IMIRequest = {
      program: 'CUSEXTMI',
      transaction: 'GetFieldValue',
      record,
      outputFields: ['A030', 'A130', 'N096'],
    }
    const resp = (await MIService.Current.executeRequest(request)) as IMIResponse
    const type = resp?.item?.A030
    const rate = resp?.item?.N096
    const requestEx = Object.assign({}, request)
    requestEx.transaction = 'GetFieldValueEx'
    requestEx.outputFields = ['CHB1']
    const respEx = (await MIService.Current.executeRequest(requestEx)) as IMIResponse
    const active = respEx?.item?.CHB1 === '1'
    const nextLocation = respEx?.item?.A130

    return { rate, type, active, nextLocation }
  }
}

module.exports = BatchKilns
