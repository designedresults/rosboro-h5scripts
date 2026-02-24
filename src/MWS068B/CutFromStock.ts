import {
  ScriptAuth
} from '@designedresults/h5-script-plus'



class CutFromStock {
  private controller: IInstanceController
  public static Init(args: IScriptArgs): void {
    new CutFromStock(args).run()
  }

  constructor(scriptArgs: IScriptArgs) {
    this.controller = scriptArgs.controller
  }

  private async run() {
    const auth = new ScriptAuth(this.controller)
    if (!auth.isAllowed({ sort: '80', view: 'CFS' })) {
      return
    }
    this.controller.Requesting.On(handleOnRequesting)
  }

}

function handleOnRequesting(args: CancelRequestEventArgs) {
  args.controller.Requesting.Off(handleOnRequesting)
  if (args.commandType === 'LSTOPT' && args.commandValue === '1') {
    const lotNumbers = ListControl.ListView.GetValueByColumnName('BANO', args.controller)
    if (lotNumbers?.length !== 0) {
      window.postMessage({source: "cut-from-stock", lotNumber: lotNumbers[0]})
      args.cancel = true;
      args.controller.PressKey('F3')
    }
    args.controller.Requesting.On(handleOnRequesting)
  }
}

module.exports = CutFromStock
