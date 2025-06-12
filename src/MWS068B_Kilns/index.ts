class MWS068B_Kilns {
  private controller: IInstanceController

  private warehouse: string
  private location: string

  constructor(scriptArgs: IScriptArgs) {
    this.controller = scriptArgs.controller
  }

  public static Init(args: IScriptArgs): void {
    new MWS068B_Kilns(args).run()
  }

  private async run() {
    const sortingOrder = this.controller.GetSortingOrder()

    this.warehouse = this.getWarehouse()
    this.location = this.getLocation()

    if (sortingOrder === '46') {
      this.showKilnStage()
    }
    if (sortingOrder === '45' && this.location.startsWith('K') && this.location.endsWith('WIP')) {
      this.showKilnWIP()
    }

  }

  private async showKilnStage() {
    const whsl = await this.getLocationDetails()
    const kiln = await this.getKilnDetails()

    if (kiln.type === 'S') {
      this.addLocationName(whsl.name)
    }

  }

  private async showKilnWIP() {
    const whsl = await this.getLocationDetails()
    const kiln = await this.getKilnDetails()

    if (kiln.type === 'C') {
      // continuous kiln

      this.addFeedRate(kiln.rate)
      if (kiln.active) {
        this.addLocationName(`${whsl.name} - CONTINUOUS (ACTIVE)`)
        this.addStopContinuous()
      } else {
        this.addLocationName(`${whsl.name} - CONTINUOUS`)
        this.addStartContinuous()
      }
    } else if (kiln.type === 'B') {
      // batch kiln
      if (kiln.active) {
        this.addLocationName(`${whsl.name} - BATCH (ACTIVE)`)
        this.addStopBatch()
      } else {
        this.addLocationName(`${whsl.name} - BATCH`)
        this.addStartBatch()
      }
    }
  }

  private getWarehouse() {
    const location = this.controller.GetValue('W1OBKV')
    return location
  }
  private getLocation() {
    let location = this.controller.GetValue('W2OBKV')
    if (!location) {
      location = this.controller.GetValue('WFSLCT')
    }
    return location
  }

  private addLocationName(name: string) {
    const lbl: ILabelElement = new LabelElement()
    lbl.Name = 'locationName'
    lbl.Position = new PositionElement()
    lbl.Position.Top = 2
    lbl.Position.Left = 40
    lbl.IsEmphasized = true
    lbl.Value = name
    this.controller.GetContentElement().AddElement(lbl)
  }

  private addLabelActive() {
    const lbl: ILabelElement = new LabelElement()
    lbl.Name = 'active'
    lbl.Position = new PositionElement()
    lbl.Position.Top = 2
    lbl.Position.Left = 65
    lbl.IsEmphasized = true
    lbl.Value = 'ACTIVE'
    this.controller.GetContentElement().AddElement(lbl)
  }

  private addFeedRate(rate: number) {
    const lbl: ILabelElement = new LabelElement()
    lbl.Name = 'lblFeedRate'
    lbl.Position = new PositionElement()
    lbl.Position.Top = 3
    lbl.Position.Left = 50
    lbl.Value = `Eff. Feed Rate:`
    this.controller.GetContentElement().AddElement(lbl)

    const txt: ITextBoxElement = new TextBoxElement()
    txt.Position = new PositionElement()
    txt.Position.Top = 3
    txt.Position.Left = 58
    txt.Position.Width = 6
    txt.Name = 'txtFeedRate'
    txt.Value = rate.toString()
    this.controller.GetContentElement().AddElement(txt)

    const btn: IButtonElement = new ButtonElement()
    btn.Position = new PositionElement()
    btn.Position.Top = 3
    btn.Position.Left = 64
    btn.Name = 'btnFeedRate'
    btn.Value = 'Update Rate'
    this.controller.GetContentElement().AddElement(btn)
  }

  private addStartContinuous() {
    const btn = new ButtonElement()
    btn.Position = new PositionElement()
    btn.Position.Top = 3
    btn.Position.Left = 40
    btn.Name = 'start'
    btn.Value = 'START'
    const el = this.controller.GetContentElement().AddElement(btn)
    $(el).on('click', async () => {
      await this.start()
      this.controller.PressKey('F5')
    })
  }

  private addStopContinuous() {
    const btn = new ButtonElement()
    btn.Position = new PositionElement()
    btn.Position.Top = 3
    btn.Position.Left = 40
    btn.Name = 'start'
    btn.Value = 'STOP'
    const el = this.controller.GetContentElement().AddElement(btn)
    $(el).on('click', async () => {
      await this.stop()
      this.controller.PressKey('F5')
    })
  }

  private addStartBatch() {
    const btn = new ButtonElement()
    btn.Position = new PositionElement()
    btn.Position.Top = 3
    btn.Position.Left = 40
    btn.Name = 'start'
    btn.Value = 'START'
    const el = this.controller.GetContentElement().AddElement(btn)
    $(el).on('click', async () => {
      await this.start()
      this.controller.PressKey('F5')
    })
  }

  private addStopBatch() {
    const btn = new ButtonElement()
    btn.Position = new PositionElement()
    btn.Position.Top = 3
    btn.Position.Left = 40
    btn.Name = 'start'
    btn.Value = 'STOP'
    const el = this.controller.GetContentElement().AddElement(btn)
    $(el).on('click', async () => {
      await this.stop()
      this.controller.PressKey('F5')
    })
  }

  protected async start() {
    const record = {
      FILE: 'MITPCE',
      PK01: this.warehouse,
      PK02: this.location,
      CHB1: '1',
    }
    const request: IMIRequest = {
      program: 'CUSEXTMI',
      transaction: 'ChgFieldValueEx',
      record,
    }
    ;(await MIService.Current.executeRequest(request)) as IMIResponse
  }

  protected async stop() {
    const record = {
      FILE: 'MITPCE',
      PK01: this.warehouse,
      PK02: this.location,
      CHB1: '0',
    }
    const request: IMIRequest = {
      program: 'CUSEXTMI',
      transaction: 'ChgFieldValueEx',
      record,
    }
    ;(await MIService.Current.executeRequest(request)) as IMIResponse
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
      outputFields: ['A030', 'N096'],
    }
    const resp = (await MIService.Current.executeRequest(request)) as IMIResponse
    const type = resp?.item?.A030
    const rate = resp?.item?.N096
    const requestEx = Object.assign({}, request)
    requestEx.transaction = 'GetFieldValueEx'
    requestEx.outputFields = ['CHB1']
    const respEx = (await MIService.Current.executeRequest(requestEx)) as IMIResponse
    const active = respEx?.item?.CHB1 === '1'

    return { rate, type, active }
  }
}

module.exports = MWS068B_Kilns
