import {
  ScriptAuth,
  TextInput
} from '@designedresults/h5-script-plus';

/**
 * Tag scan
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
 * |`ITNO`|41|Target field for item number
 * |`BANO`|41|Target field for lot number|
 * 
 * Example arg string: `TOP,10,LEFT,40,VIEW,ADJ01`
 * 
 * 
 */
export class TagScan {
  private controller: IInstanceController
  private log: IScriptLog
  private facility: string
  private warehouse: string

  private top: number
  private left: number;
  private view?: string;
  private sort?: string;

  private facilityField: string;
  private warehouseField: string;
  private itemNumberField: string;
  private lotNumberField: string;
  private quantityField: string;

  private scan?: TextInput

  public static Init(args: IScriptArgs): void {
    new TagScan(args).run()
  }

  constructor(scriptArgs: IScriptArgs) {
    this.controller = scriptArgs.controller
    this.log = scriptArgs.log
    const userContext = ScriptUtil.GetUserContext()
    this.facility = userContext.FACI
    this.warehouse = userContext.WHLO

    const arr = scriptArgs.args.split(',');
    this.top = Number(this.getArg(arr, 'TOP')) || 9
    this.left = Number(this.getArg(arr, 'LEFT')) || 10
    this.view = this.getArg(arr, 'VIEW')
    this.sort = this.getArg(arr, 'SORT')

    this.facilityField = this.getArg(arr, 'FACI') || ''
    this.warehouseField = this.getArg(arr, 'WHLO') || ''
    this.itemNumberField = this.getArg(arr, 'ITNO') || ''
    this.lotNumberField = this.getArg(arr, 'BANO') || ''
    this.quantityField = this.getArg(arr, 'QTY') || ''

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
    }

  }

  protected addUI() {
    this.scan = new TextInput(this.controller)
      .name('txt-scan')
      .value('')
      .position(this.top, this.left)
      .width(40)
      .build()
    this.scan?.el?.attr('placeholder', "Scan tag")
    this.scan.onInput(() => {
      const value = this.scan?.getString()
      if (value) {
        this.updateFields(value)
      }
    })
    this.scan.focus()
  }


  protected parseScan(value?: string) {
    let itemNumber
    let lotNumber
    let quantity
    if (value) {
      const matches = new RegExp(/itno(\w*)\/bano(\w*)\/qty(\w*)/gi).exec(value)
      if (matches) {
        itemNumber = matches[1]?.toUpperCase()
        lotNumber = matches[2]?.toUpperCase()
        quantity = Number(matches[3])
      }
    }
    return { itemNumber, lotNumber, quantity }
  }

  protected async updateFields(value: string) {
    const { itemNumber, lotNumber, quantity } = this.parseScan(value)
    let valueSet = false

    if (this.facilityField) {
      this.controller.SetValue(this.facilityField, this.facility)
      valueSet = true
    }
    if (this.warehouseField) {
      this.controller.SetValue(this.warehouseField, this.warehouse)
      valueSet = true
    }
    if (this.itemNumberField && itemNumber) {
      this.controller.SetValue(this.itemNumberField, itemNumber)
      valueSet = true
    }
    if (this.lotNumberField && lotNumber) {
      this.controller.SetValue(this.lotNumberField, lotNumber)
      valueSet = true
    }
    if (this.quantityField && quantity) {
      this.controller.SetValue(this.quantityField, quantity)
      valueSet = true
    }

    if (valueSet) {
      await new Promise(r => setTimeout(r, 200))
      this.controller.PressKey('F5')
    }
  }

}

module.exports = TagScan

type AutocompleteSearchTerm = {
  term: string
}

type AutocompleteItem = {
  value: string,
  label: string
}

