import {
  ActionButton,
  Colors,
  formatErrorMessage,
  H5Dialog,
  Label,
  M3API,
  TextArea,
  TextInput,
} from '@designedresults/h5-script-plus'
export class BatchInfo {
  private controller: IInstanceController
  private log: IScriptLog
  private warehouse: string
  private product: string
  private orderNumber: string

  private externalReferenceNumber: TextInput
  private batchAttributes: TextArea
  private externalReferenceDescription: TextInput
  private layerAttributes: TextArea

  constructor(scriptArgs: IScriptArgs) {
    this.controller = scriptArgs.controller
    this.log = scriptArgs.log
    if (scriptArgs.args.endsWith('!DEBUG')) {
      this.log.SetDebug()
    }
    this.warehouse = this.getWarehouse()
    this.product = this.getProduct()
    this.orderNumber = this.getOrderNumber()
  }

  public static Init(args: IScriptArgs): void {
    new BatchInfo(args).run()
  }

  private async run() {
    const facility = await this.getFacility(this.warehouse)
    this.addUI(facility)
    const { externalReferenceNumber, externalReferenceDescription } = await this.getExternalReferences(facility)
    this.externalReferenceNumber.setString(externalReferenceNumber)
    this.setBatchAttributes(this.parseExternalReferenceNumber(externalReferenceNumber))

    this.externalReferenceDescription.setString(externalReferenceDescription)
    this.setLayerAttributes(this.parseExternalReferenceDescription(externalReferenceDescription))
  }

  private addUI(facility: string) {
    const changeMode = this.controller.GetMode() === '2'
    new Label(this.controller)
      .name('lbl-ExternalReferenceNumber')
      .value('External Reference Number (EXRN)')
      .position(8, 75)
      .build()
    this.externalReferenceNumber = new TextInput(this.controller)
      .name('txt-ExternalReferenceNumber')
      .value('')
      .position(9, 75)
      .width(20)
      .build()

    if (changeMode) {
      new ActionButton(this.controller)
        .name('btn-SaveEXRN')
        .value('Save')
        .position(9, 95)
        .action(async () => {
          await this.save(facility)
        })
        .build()
    } else {
      this.externalReferenceNumber.disable()
      $(this.externalReferenceNumber?.el).css("color", Colors.black).css("background-color", Colors.gray)
    }

    this.batchAttributes = new TextArea(this.controller)
      .name('txtArea-BatchAttributes')
      .value('')
      .position(10, 75)
      .width(20)
      .enabled(false)
      .color('black')
      .backgroundColor(Colors.gray)
      .build()
    this.batchAttributes.disable()

    $(this.externalReferenceNumber?.el).on('input change', (e: any) => {
      const attrs = this.parseExternalReferenceNumber(e.target.value)
      this.setBatchAttributes(attrs)
    })

    new Label(this.controller)
      .name('lbl-ExternalReferenceDescription')
      .value('External Reference Description (EXD2)')
      .position(13, 75)
      .build()
    this.externalReferenceDescription = new TextInput(this.controller)
      .name('txt-ExternalReferenceDescription')
      .value('')
      .position(14, 75)
      .width(30)
      .build()
    if (changeMode) {
      new ActionButton(this.controller)
        .name('btn-SaveEXRN')
        .value('Save')
        .position(14, 105)
        .action(async () => {
          await this.save(facility)
        })
        .build()
    } else {
      this.externalReferenceDescription.disable()
      $(this.externalReferenceDescription?.el).css("color", Colors.black).css("background-color", Colors.gray)
    }
    this.layerAttributes = new TextArea(this.controller)
      .name('txtArea-LayerAttributes')
      .value('')
      .position(15, 75)
      .height(140)
      .enabled(false)
      .color('black')
      .backgroundColor(Colors.gray)
      .build()
    this.layerAttributes.disable()

    $(this.externalReferenceDescription?.el).on('input change', (e: any) => {
      const attrs = this.parseExternalReferenceDescription(e.target.value)
      this.setLayerAttributes(attrs)
    })
  }

  private getWarehouse() {
    const value = this.controller.GetValue('VHWHLO')
    this.log.Debug(`Warehouse (VHWHLO) = ${value}`)
    return value
  }

  private getProduct() {
    const value = this.controller.GetValue('WWPRNO')
    this.log.Debug(`Product (WWPRNO) = ${value}`)
    return value
  }

  private getOrderNumber() {
    const value = this.controller.GetValue('WWMFNO')
    this.log.Debug(`Order number (WWMFNO) = ${value}`)
    return value
  }

  private async getFacility(warehouse: string) {
    const req: IMIRequest = {
      program: 'MMS005MI',
      transaction: 'GetWarehouse',
      record: {
        WHLO: warehouse,
      },
      outputFields: ['FACI'],
    }
    const res = await M3API.executeRequest(req, 'PMS100F_BatchInfo')
    this.log.Debug(JSON.stringify({ req, res }))
    return res?.item?.FACI
  }

  private async getExternalReferences(facility: string) {
    const QERY = `VHEXRN, VHEXD2 from MWOHED where VHFACI = ${facility} and VHPRNO = ${this.product} and VHMFNO = ${this.orderNumber}`
    const SEPC = '~'
    const req: IMIRequest = {
      program: 'EXPORTMI',
      transaction: 'Select',
      record: { QERY, SEPC },
      maxReturnedRecords: 1,
    }

    const res = await M3API.executeRequest(req, 'PMS050E_MO')
    this.log.Debug(JSON.stringify({ req, res }))

    const values = res?.item?.REPL?.split(SEPC)
    if (values?.length === 2) {
      return { externalReferenceNumber: values[0], externalReferenceDescription: values[1] }
    }
  }

  private async save(facility: string) {
    try {
      await this.updateExternalReferences(
        facility,
        this.externalReferenceNumber.getString(),
        this.externalReferenceDescription.getString()
      )
      new H5Dialog('Update Batch Attributes', 'Batch attributes updated.').show()
      this.controller.PressKey('F5')
    } catch (err) {
      new H5Dialog('Update Batch Attributes', formatErrorMessage(err)).error().show()
    }
  }

  private async updateExternalReferences(
    facility: string,
    externalReferenceNumber: string,
    externalReferenceDescription: string
  ) {
    const req: IMIRequest = {
      program: 'PMS100MI',
      transaction: 'UpdMO',
      record: {
        FACI: facility,
        PRNO: this.product,
        MFNO: this.orderNumber,
        EXRN: externalReferenceNumber,
        EXD2: externalReferenceDescription,
      },
    }
    const res = await M3API.executeRequest(req)
    this.log.Debug(JSON.stringify({ req, res }))
  }

  private parseExternalReferenceNumber(value: string) {
    const els = value.split(',')
    let pushes = ''
    if (els.length >= 0) {
      pushes = els[0]
    }

    let batchLength = ''
    if (els.length >= 1) {
      batchLength = els[1]
    }

    let batchHeight = ''
    if (els.length >= 2) {
      batchHeight = els[2]
    }

    let fillLams = ''
    if (els.length >= 3) {
      fillLams = els[3]
    }
    return {
      pushes,
      batchLength,
      batchHeight,
      fillLams,
    }
  }

  private setBatchAttributes(attrs: any) {
    let content: string[] = []
    content.push(`Pushes: ${attrs.pushes ?? ''}`)
    content.push(`Batch length: ${attrs.batchLength ?? ''}`)
    content.push(`Batch height: ${attrs.batchHeight ?? ''}`)
    content.push(`Fill lams: ${attrs.fillLams ?? ''}`)
    this.batchAttributes.setString(content.join('\r'))
  }

  private parseExternalReferenceDescription(value: string) {
    return value.split(',')
  }

  private setLayerAttributes(layers: string[]) {
    let content: string[] = []
    layers.forEach((layer, i) => {
      content.push(`Layer ${i + 1}: ${layer ?? 0}`)
    })
    this.layerAttributes.setString(content.join('\r'))
  }
}

module.exports = BatchInfo
