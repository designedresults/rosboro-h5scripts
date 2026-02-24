import Dialog from '../Dialog'
import MBMInit, { IMBMInit } from '../MBMInit'

class ContinuousKilns {
  private controller: IInstanceController

  private top = 7
  private left = 34

  private warehouse: string
  private location: string
  private hours = 0
  private rate = 0

  constructor(scriptArgs: IScriptArgs) {
    this.controller = scriptArgs.controller
  }

  public static Init(args: IScriptArgs): void {
    new ContinuousKilns(args).run()
  }

  private async run() {
    const sortingOrder = this.controller.GetSortingOrder()

    this.warehouse = this.getWarehouse()
    this.location = this.getLocation()

    if (sortingOrder === '45') {
      const whsl = await this.getLocationDetails()
      const kiln = await this.getKilnDetails()
      this.rate = kiln.rate

      this.addProcess()
      if (kiln.type === 'CONT_WIP') {
        this.addHours(-12, 12)
        this.addUpdate(whsl)
        this.addProcess()
        this.addRate(0, 6)
        // if (kiln.active) {
        //   this.addPause(whsl)
        // } else {
        //   this.addResume(whsl)
        // }
      } else if (kiln.type === 'CONT_WIP') {
        this.addProcess()
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

  private addProcess() {
    const btn = new ButtonElement()
    btn.Position = new PositionElement()
    btn.Position.Top = this.top
    btn.Position.Left = this.left + 80
    btn.Name = 'btn-process'
    btn.Value = 'Process'
    const el = this.controller.GetContentElement().AddElement(btn)
    $(el).on('click', async () => {
      try {
        await this.process()
        new Dialog('Process Kiln Transactions', 'Process kiln transactions job submitted').show()
      } catch (err) {
        new Dialog('Process Kiln Transactions', `<pre>${JSON.stringify(err)}</pre>`).error().show()
      }
      this.controller.PressKey('F5')
    })
  }

  // private addPause(whsl: any) {
  //   const btn = new ButtonElement()
  //   btn.Position = new PositionElement()
  //   btn.Position.Top = this.top
  //   btn.Position.Left = this.left + 30
  //   btn.Name = 'pause'
  //   btn.Value = 'PAUSE'
  //   const el = this.controller.GetContentElement().AddElement(btn)
  //   $(el).on('click', async () => {
  //     try {
  //       const msg = `
  //       <p>${whsl.name} will be paused</p>
  //       <p>Are you sure you want to start continue?</p>
  //       `
  //       const ok = await new Dialog('Start Batch Kiln', msg).withCancel().show()
  //       if (ok) {
  //         new Dialog('Pause Continuous Kiln', 'Pause continuous kiln job submitted').show()
  //       }
  //     } catch (err) {
  //       new Dialog('Pause Continuous Kiln', `<pre>${JSON.stringify(err)}</pre>`).error().show()
  //     }
  //     this.controller.PressKey('F5')
  //   })
  // }

  // private addResume(whsl: any) {
  //   const btn = new ButtonElement()
  //   btn.Position = new PositionElement()
  //   btn.Position.Top = this.top
  //   btn.Position.Left = this.left + 30
  //   btn.Name = 'resume'
  //   btn.Value = 'Resume BATCH'
  //   const el = this.controller.GetContentElement().AddElement(btn)
  //   $(el).on('click', async () => {
  //     try {
  //       // await this.startBatch(this.warehouse, this.location)
  //       const msg = `
  //       <p>${whsl.name} will be resumed</p>
  //       <p>Are you sure you want to continue?</p>
  //       `
  //       const ok = await new Dialog('Resume Continuous Kiln', msg).withCancel().show()
  //       if (ok) {
  //         new Dialog('Resume Continuous Kiln', 'Resume continuous kiln job submitted').show()
  //       }
  //     } catch (err) {
  //       new Dialog('Resume Continuous Kiln', `<pre>${JSON.stringify(err)}</pre>`).error().show()
  //     }
  //     this.controller.PressKey('F5')
  //   })
  // }

  private addUpdate(whsl: any) {
    const btn = new ButtonElement()
    btn.Position = new PositionElement()
    btn.Position.Top = this.top
    btn.Position.Left = this.left + 11
    btn.Name = 'update'
    btn.Value = 'UPDATE Hours'
    const el = this.controller.GetContentElement().AddElement(btn)
    $(el).on('click', async () => {
      try {
        const msg = `
        <p>Stop and release time for ${whsl.name} will be updated by ${this.hours} hours.</p>
        <p>Are you sure you want to update?</p>
        `
        const ok = await new Dialog('Update Continuous Kiln', msg).withCancel().show()
        if (ok) {
          this.controller.ShowBusyIndicator()
          await this.update()
          this.controller.HideBusyIndicator()
          new Dialog('Update Continuous Kiln', 'Update continuous kiln job submitted').show()
        }
      } catch (err) {
        new Dialog('Update Continuous Kiln', `<pre>${JSON.stringify(err)}</pre>`).error().show()
      }
      this.controller.HideBusyIndicator()
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
    txt.Position.Left = this.left + 6
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

  private addRate(min: number, max: number) {
    const lbl: ILabelElement = new LabelElement()
    lbl.Position = new PositionElement()
    lbl.Position.Top = this.top
    lbl.Position.Left = this.left + 25
    lbl.Name = 'lbl-Rate'
    lbl.Value = 'Feed rate'
    this.controller.GetContentElement().AddElement(lbl)

    const txt: ITextBoxElement = new TextBoxElement()
    txt.Position = new PositionElement()
    txt.Position.Top = this.top
    txt.Position.Left = this.left + 30
    txt.Position.Width = 4
    txt.Name = 'txt-Rate'
    txt.Value = Number(this.rate).toFixed(1)
    txt.IsRightJustified = true
    const el = this.controller.GetContentElement().AddElement(txt)
    $(el).find('input').attr('type', 'number').attr('min', min).attr('max', max).attr('step', '.1')
    $(el).on('input', (e: any) => {
      let num = Number(e.target.value)
      if (!isNaN(num)) {
        this.rate = Math.round(num * 10) / 10
      }
    })

    const btn = new ButtonElement()
    btn.Position = new PositionElement()
    btn.Position.Top = this.top
    btn.Position.Left = this.left + 35
    btn.Name = 'update'
    btn.Value = 'UPDATE Feed Rate'
    const btnEl = this.controller.GetContentElement().AddElement(btn)
    $(btnEl).on('click', async () => {
      try {
        const msg = `
        <p>Are you sure you want to update the feed rate for <b>${this.location}</b> to <b>${this.rate}</b>?</p>
        `
        const ok = await new Dialog('Update Continuous Kiln', msg).withCancel().show()
        if (ok) {
          this.controller.ShowBusyIndicator()
          await this.updateFeedrate()
          this.controller.HideBusyIndicator()
          new Dialog('Update Continuous Kiln', 'Feed rate updated.').show()
        }
      } catch (err) {
        new Dialog('Update Continuous Kiln', `<pre>${JSON.stringify(err)}</pre>`).error().show()
      }
      this.controller.HideBusyIndicator()
      this.controller.PressKey('F5')
    })
  }

  // protected async pause(warehouse: string, location: string) {
  //   const mbm: IMBMInit = {
  //     documentNumber: 'MBM',
  //     mediaCtrl1: 'KLIN',
  //     mediaProfile: 'PAUSE',
  //     printerFile: 'MBM',
  //     field: 'WHLO',
  //     documentIdentity: warehouse,
  //     messageKey4Field: 'WHSL',
  //     messageKey4Value: location,
  //   }
  //   await MBMInit.sendMBM(mbm)
  //   return mbm
  // }

  // protected async resume(warehouse: string, location: string) {
  //   const mbm: IMBMInit = {
  //     documentNumber: 'MBM',
  //     mediaCtrl1: 'KLIN',
  //     mediaProfile: 'RESUME',
  //     printerFile: 'MBM',
  //     field: 'WHLO',
  //     documentIdentity: warehouse,
  //     messageKey4Field: 'WHSL',
  //     messageKey4Value: location,
  //   }
  //   await MBMInit.sendMBM(mbm)
  //   return mbm
  // }

  protected async process() {
    const mbm: IMBMInit = {
      documentNumber: 'MBM',
      mediaCtrl1: 'KILN',
      mediaCtrl2: 'TRANS',
      printerFile: 'MBM',
      field: 'WHLO',
      documentIdentity: this.warehouse,
    }
    await MBMInit.sendMBM(mbm)
    return mbm
  }

  protected async update() {
    const mbm: IMBMInit = {
      documentNumber: 'MBM',
      mediaCtrl1: 'KILN',
      mediaCtrl2: 'UPDATE',
      printerFile: 'MBM',
      field: 'WHLO',
      documentIdentity: this.warehouse,
      messageKey4Field: 'WHSL',
      messageKey4Value: this.location,
      messageKey5Field: 'HOUR',
      messageKey5Value: this.hours.toString(),
    }
    await MBMInit.sendMBM(mbm)
    return mbm
  }

  protected async updateFeedrate() {
    const mbm: IMBMInit = {
      documentNumber: 'MBM',
      mediaCtrl1: 'KILN',
      mediaCtrl2: 'CHANGERATE',
      printerFile: 'MBM',
      field: 'WHLO',
      documentIdentity: this.warehouse,
      messageKey4Field: 'WHSL',
      messageKey4Value: this.location,
      messageKey5Field: 'RATE',
      messageKey5Value: this.rate.toFixed(1),
    }
    await MBMInit.sendMBM(mbm)
    // add delay to allow time for job to kick off
    await new Promise(r => setTimeout(r, 8000))
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

module.exports = ContinuousKilns
