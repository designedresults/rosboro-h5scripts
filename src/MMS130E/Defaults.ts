class MMS130E_Defaults {
  private controller: IInstanceController
  private log: IScriptLog


  constructor(scriptArgs: IScriptArgs) {
    this.controller = scriptArgs.controller
    this.log = scriptArgs.log
    if (scriptArgs.args.endsWith('!DEBUG')) {
      this.log.SetDebug()
    }

  }

  public static Init(args: IScriptArgs): void {
    new MMS130E_Defaults(args).run()
  }

  private async run() {

    if (!this.getNewItemNumber()) {
      this.setNewItemNumber(this.getItemNumber())
    }
    if (!this.getNewLotNumber()) {
      this.setNewLotNumber(this.getLotNumber())
      this.setLotRef1(this.getLotNumber())
    }

  }

  private getItemNumber() {
    const value = this.controller.GetValue('WWITNO')
    this.log.Debug(`Item (WWITNO) = ${value}`)
    return value
  }

  private getLotNumber() {
    const value = this.controller.GetValue('WWBANO')
    this.log.Debug(`Lot number (WWBANO) = ${value}`)
    return value
  }
  private getNewItemNumber() {
    const value = this.controller.GetValue('WWNITN')
    this.log.Debug(`Item (WWITN) = ${value}`)
    return value
  }
  private setNewItemNumber(value: string) {
    this.log.Debug(`Set New item number (WWNITN) = ${value}`)
    this.controller.SetValue('WWNITN', value)
  }
  private getNewLotNumber() {
    const value = this.controller.GetValue('WWNNBAN')
    this.log.Debug(`Item (WWNBAN) = ${value}`)
    return value
  }
  private setNewLotNumber(value: string) {
    this.log.Debug(`Set New item number (WWNBAN) = ${value}`)
    this.controller.SetValue('WWNBAN', value)
  }

  private setLotRef1(value: string) {
    this.log.Debug(`Set Lot ref 1 (WLBREF) = ${value}`)
    this.controller.SetValue('WLBREF', value)
  }

}


module.exports = MMS130E_Defaults
