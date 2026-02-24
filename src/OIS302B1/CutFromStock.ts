import {
  ActionButton,
  BulkM3API,
  CSRF,
  formatErrorMessage,
  getFieldValue,
  H5Dialog,
  IMIBulkResponse,
  Label,
  M3API,
  ScriptAuth,
  TextInput
} from '@designedresults/h5-script-plus';
import numeral from 'numeral';
import Dialog from '../Dialog';

type OrderLine = {
  warehouse: string;
  reqDelDate: string;
  customerNumber: string;
  orderNumber: string;
  lineNumber: string;
  itemNumber: string;
  orderQty: number;
  allocQty: number;
  widthGroup: string;
  lengthGroup: string;
  depthGroup: string;
  lengthFeet: number;
}

function handleSelectionChanged() {
  this.onSelectionChange()
}

function handleMessage(e: MessageEvent) {
  this.onMessage(e)
}

class CutFromStock {
  private controller: IInstanceController
  private userId: string;
  private company: string;

  private top: number = 6
  private left: number = 30

  private warehouse: string;
  private orderLines: OrderLine[]

  private searchButton: ActionButton
  private lotNumber: TextInput
  private itemNumber: TextInput
  private location: TextInput
  private status: TextInput
  private availableQty: TextInput
  private cutQty: TextInput

  private cutButton: ActionButton

  private idsDataGrid: any
  private selectedRows: any[]

  private bulkM3API: BulkM3API
  public static Init(args: IScriptArgs): void {
    new CutFromStock(args).run()
  }

  constructor(scriptArgs: IScriptArgs) {
    this.controller = scriptArgs.controller

    const ctx = ScriptUtil.GetUserContext()
    this.userId = ctx.USID
    this.company = ctx.CurrentCompany
    this.idsDataGrid = this.controller.GetGrid()['idsDataGrid']
    this.bulkM3API = new BulkM3API(new CSRF())
  }

  private onMessage(e: MessageEvent) {
    console.log(e)
    if (e.data?.source === 'cut-from-stock') {
      if (e.data?.lotNumber) {
        this.lotNumber.setString(e.data?.lotNumber)
        this.onLotChange()
      }
    }
  }

  private async run() {
    const auth = new ScriptAuth(this.controller)
    if (!auth.isAllowed({ sort: '91', view: 'CFS' })) {
      return
    }
    this.addUI()

    this.warehouse = getFieldValue(this.controller, 'OBWHLO')

    window.removeEventListener('message', handleMessage.bind(this))
    window.addEventListener('message', handleMessage.bind(this))

    this.idsDataGrid?.offEvent('selectionchanged', handleSelectionChanged.bind(this))
    this.idsDataGrid?.addEventListener('selectionchanged', handleSelectionChanged.bind(this))

  }

  protected async addUI() {

    new Label(this.controller)
      .name('lbl-cfs-title').value('CUT FROM STOCK')
      .bold()
      .position(this.top, this.left).build()

    // lot
    new Label(this.controller)
      .name('lbl-cfs-lot-number')
      .value('Lot number')
      .position(this.top + 1, this.left)
      .build()
    this.lotNumber = new TextInput(this.controller)
      .name('txt-cfs-lot-number')
      .value('')
      .position(this.top + 1, this.left + 10)
      .build()

    const handleLotChange = debounce(async () => {
      this.onLotChange()
    }, 300)
    this.lotNumber.onInput(handleLotChange)

    // item
    new Label(this.controller)
      .name('lbl-cfs-item-number')
      .value('Item number')
      .position(this.top + 2, this.left)
      .build()
    this.itemNumber = new TextInput(this.controller)
      .name('txt-cfs-item-number')
      .value('')
      .position(this.top + 2, this.left + 10)
      .enabled(false)
      .build()
    // location
    new Label(this.controller)
      .name('lbl-cfs-location')
      .value('Location')
      .position(this.top + 3, this.left)
      .build()
    this.location = new TextInput(this.controller)
      .name('txt-cfs-location')
      .value('')
      .width(10)
      .position(this.top + 3, this.left + 10)
      .enabled(false)
      .build()

    // status
    new Label(this.controller)
      .name('lbl-cfs-status')
      .value('Sts')
      .position(this.top + 3, this.left + 20)
      .build()
    this.status = new TextInput(this.controller)
      .name('txt-cfs-status')
      .value('')
      .width(4)
      .position(this.top + 3, this.left + 22)
      .enabled(false)
      .build()

    // avail qty
    new Label(this.controller)
      .name('lbl-cfs-avail-qty')
      .value('Available Qty')
      .position(this.top + 2, this.left + 30)
      .build()
    this.availableQty = new TextInput(this.controller)
      .name('txt-cfs-avail-qty')
      .value('')
      .width(8)
      .position(this.top + 3, this.left + 30)
      .enabled(false)
      .rightAlign(true)
      .build()


    // cut qty
    new Label(this.controller)
      .name('lbl-cfs-cut-qty')
      .value('Cut Qty')
      .position(this.top + 2, this.left + 40)
      .build()
    this.cutQty = new TextInput(this.controller)
      .name('txt-cfs-cut-qty')
      .value('')
      .width(8)
      .position(this.top + 3, this.left + 40)
      .rightAlign(true)
      .build()

    this.searchButton = new ActionButton(this.controller)
      .name('btn-cut-from-stock')
      .value('⌕')
      .position(this.top + 1, this.left + 23)
      .action(async () => {
        try {
          const sortingOrder = '80';
          const view = 'CFS';
          const WHLO = this.warehouse
          const ITNO = this.itemNumber.getString()
          const bookmark = `bookmark?program=MWS068&startPanel=B&includeStartPanel=True&tableName=MITLOC&sortingOrder=${sortingOrder}&source=MForms&view=${view}&requirePanel=True&keys=MLCONO,<CONO>,MLWHLO,${WHLO},MLITNO,${ITNO},MLWHSL,,MLBANO,,MLCAMU,,MLREPN,&fields=WWNFTR,2,WWAGGR,0,W1OBKV,${WHLO},W2OBKV,${ITNO}&LogicalId=lid://infor.m3.m3`
          ScriptUtil.Launch(bookmark)
        } catch (error) {
          new Dialog().title('Cut From Stock').message(formatErrorMessage(error)).type('Alert').show()
        }
      })
      .build()
    this.searchButton.disable()

    this.cutButton = new ActionButton(this.controller)
      .name('btn-cfs-cut')
      .value('CUT')
      .position(this.top + 3, this.left + 50)
      .action(async () => {
        this.searchButton.disable()
        this.cutQty.disable()
        this.lotNumber.disable()
        await this.cut()
        this.cutQty.enable()
        this.lotNumber.enable()
        this.searchButton.enable()
      })
      .build()
    this.cutButton.disable()



  }

  protected async onLotChange() {
    this.lotNumber.showLoading()
    this.cutButton.disable()

    const warehouse = getFieldValue(this.controller, 'WHLO')
    const balId = await this.getBalId(warehouse, this.itemNumber.getString(), this.lotNumber.getString())
    if (balId) {
      this.location.setString(balId.WHSL)
      this.status.setString(balId.STAS)
      const onHand = numeral(balId.STQT).value()
      const allocated = numeral(balId.ALQT).value()
      const avail = onHand - allocated
      this.availableQty.setString(numeral(avail).format())
      let cutQty = numeral(this.cutQty.getString()).value()
      cutQty = Math.min(cutQty, avail)
      this.cutQty.setString(numeral(cutQty).format())
      if (avail > 0) {
        this.cutButton.enable()
      }
    }


    this.lotNumber.hideLoading()
  }


  protected resetUI() {
    this.itemNumber.setString('')
    this.location.setString('')
    this.status.setString('')
    this.availableQty.setString('')
    this.cutQty.setString('')
  }


  protected async onSelectionChange() {
    let lines = []
    this.orderLines = []
    this.resetUI()
    this.selectedRows = this.controller.GetGrid().getSelectedGridRows()

    try {

      lines = this.getOrderLines()
      this.validateLines(lines)

      // validation checks for same width and depth group
      const widthGroup = lines[0].widthGroup
      const depthGroup = lines[0].depthGroup
      let lengthGroup = ''

      let cutQty = lines[0].orderQty - lines[0].allocQty

      if (lines.length === 1) {
        lengthGroup = numeral((lines[0].lengthFeet ?? 0) * 2).format() + "0"
        cutQty = cutQty / 2
      } else if (lines.length === 2) {
        lengthGroup = numeral((lines[0].lengthFeet ?? 0) + (lines[1].lengthFeet ?? 0)).format() + "0"
      }

      this.cutQty.setString(numeral(cutQty).format())

      this.itemNumber.showLoading()
      const stockItem = await this.searchStockItem(widthGroup, lengthGroup, depthGroup)

      if (stockItem) {
        this.searchButton.enable()
        this.itemNumber.setString(stockItem)
      } else {
        this.searchButton.disable()
      }
      this.itemNumber.hideLoading()

      this.orderLines = lines
      await this.onLotChange()


    } catch (err) {
      this.searchButton.disable()

    }


  }

  protected getOrderLines() {
    const lines: OrderLine[] = []
    if (this.selectedRows.length !== 1 && this.selectedRows.length !== 2) {
      throw 'Select one or two order lines'
    }
    for (const row of this.selectedRows) {
      const warehouse = getFieldValue(this.controller, 'OBWHLO', row)
      const reqDelDate = getFieldValue(this.controller, 'OBDWDT', row)
      const customerNumber = getFieldValue(this.controller, 'OBCUNO', row)
      const orderNumber = getFieldValue(this.controller, 'OBORNO', row)
      const lineNumber = getFieldValue(this.controller, 'OBPONR', row)
      const itemNumber = getFieldValue(this.controller, 'OBITNO', row)
      const orderQty = getFieldValue(this.controller, 'OBORQT', row)
      const allocQty = getFieldValue(this.controller, 'OBALQT', row)
      const widthGroup = getFieldValue(this.controller, 'MMGRP1', row)
      const lengthGroup = getFieldValue(this.controller, 'MMGRP2', row)
      const depthGroup = getFieldValue(this.controller, 'MMGRP3', row)
      const lengthFeet = getFieldValue(this.controller, 'MMILEN', row)

      if (!(warehouse && reqDelDate && customerNumber && itemNumber && orderNumber && lineNumber && widthGroup && lengthGroup && depthGroup && lengthFeet)) {
        throw new Error('Missing required field to cut from stock')
      }

      lines.push({
        warehouse, reqDelDate, customerNumber, itemNumber, orderNumber, lineNumber, orderQty: numeral(orderQty).value(), allocQty: numeral(allocQty).value(),
        widthGroup, lengthGroup, depthGroup, lengthFeet: numeral(lengthFeet).value()
      })
    }

    return lines
  }

  protected validateLines(lines: OrderLine[]) {
    const orderNumber = new Set<string>()
    const orderQty = new Set<number>()
    const allocQty = new Set<number>()
    const widthGroup = new Set<string>()
    const depthGroup = new Set<string>()


    for (const line of lines) {
      orderNumber.add(line.orderNumber)
      orderQty.add(line.orderQty)
      allocQty.add(line.allocQty)
      widthGroup.add(line.widthGroup)
      depthGroup.add(line.depthGroup)
    }

    if (orderNumber.size > 1) {
      throw 'Select order lines from only ONE order'
    }

    if (orderQty.size > 1) {
      throw 'Select order lines with the same order qty'
    }
    if (allocQty.size > 1) {
      throw 'Select order lines with the same alloc qty'
    }

    if (widthGroup.size > 1) {
      throw 'Select order lines with the same width group'
    }
    if (depthGroup.size > 1) {
      throw 'Select order lines with the same depth group'
    }

  }

  protected async searchStockItem(widthGroup: string, lengthGroup: string, depthGroup: string) {
    const req: IMIRequest = {
      program: "MMS200MI",
      transaction: 'SearchItem',
      record: { SQRY: `ITNO:XB* GRP1:${widthGroup} GRP2:${lengthGroup} GRP3:${depthGroup}` },
      outputFields: ['ITNO', 'GRP1', 'GRP2', 'GRP3']
    }

    const resp = await this.bulkM3API.executeRequest([req])
    const item = resp.results?.at(0)?.records?.at(0)
    return item?.ITNO
  }

  protected async getBalId(warehouse: string, itemNumber: string, lotNumber: string) {
    if (!warehouse || !itemNumber || !lotNumber) {
      return
    }
    const req: IMIRequest = {
      program: "MMS060MI",
      transaction: 'LstBalID',
      record: { WHLO: warehouse, ITNO: itemNumber, BANO: lotNumber },
      outputFields: ['WHLO', 'ITNO', 'WHSL', 'BANO', 'STAS', 'STQT', 'ALQT']
    }

    const resp = await this.bulkM3API.executeRequest([req])
    const item = resp.results?.at(0)?.records?.at(0)
    return item
  }

  protected async cut() {
    let respAdjOff: IMIBulkResponse
    let respAdjOn: IMIBulkResponse
    let respAlloc: IMIBulkResponse
    let error = false;
    let html = ''
    html += `
    <style>
    table#tbl-cfs {
      border-collapse: collapse;
    }
    #tbl-cfs thead th {
      border-bottom: 1px solid #000;
      font-weight: bold;
    }
    #tbl-cfs td.subtitle {
      background-color: #ccc;
    }
    #tbl-cfs td {
      padding: .125em .25em;
    }
    #tbl-cfs td.qty {
      text-align: right;
    }
    #tbl-cfs td.error {
      color: #f00;
    }
    </style>
    <table id="tbl-cfs">
      <thead>
        <tr>
          <th>Item</th>
          <th>Lot number</th>
          <th>Location</th>
          <th>Qty</th>
          <th>CO</th>
          <th>Line</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td colspan="7" class="subtitle">Adjust off stock beams</td>
        </tr>
    `

    // Adjust off stock beams
    respAdjOff = await this.adjustStockBeamOff()
    html += `
      <tr>
        <td>${respAdjOff.results?.at(0)?.parameters?.ITNO}</td>
        <td>${respAdjOff.results?.at(0)?.parameters?.BANO}</td>
        <td>${respAdjOff.results?.at(0)?.parameters?.WHSL}</td>
        <td class="qty">${respAdjOff.results?.at(0)?.parameters?.QLQT}</td>
        <td></td>
        <td></td>
        <td class="error">${respAdjOff.results?.at(0)?.errorMessage ?? ''}</td>
      </tr>
      `

    // Adjust on ordered beams
    html += `
         <tr>
          <td colspan="7" class="subtitle">Adjust on ordered beams</td>
        </tr>
        `
    if (respAdjOff.nrOfFailedTransactions) {
      html += `
         <tr>
          <td colspan="7" class="error">No ordered beams adjusted on</td>
        </tr>
        `
    } else {
      respAdjOn = await this.adjustOrderedBeamOn()
      for (const res of respAdjOn.results) {
        html += `
            <tr>
              <td>${res.parameters?.ITNO}</td>
              <td>${res.parameters?.BANO}</td>
              <td>${res.parameters?.WHSL}</td>
              <td class="qty">${res.parameters?.QLQT}</td>
              <td></td>
              <td></td>
              <td class="error">${res.errorMessage ?? ''}</td>
            </tr>
            `
      }
    }

    // Allocate ordered beams
    html += `
         <tr>
          <td colspan="7" class="subtitle">Allocate ordered beams</td>
        </tr>
        `
    if (respAdjOn.nrOfFailedTransactions) {
      html += `
         <tr>
          <td colspan="7" class="error">No beams allocated</td>
        </tr>
        `
    } else {

      const allocationMethod = await this.getAllocationMethod()
      // force allocation method to 1-manually to allow directly allocating order
      if (allocationMethod !== "1") {
        await this.updateAllocationMethod("1");
        await new Promise(r => setTimeout(r, 500)) // 1/2 sec delay
      }

      // allocate the order
      respAlloc = await this.allocateOrder()

      // reset the allocation method
      if (allocationMethod !== "1") {
        await this.updateAllocationMethod(allocationMethod);
      }

      for (const res of respAlloc.results) {
        html += `
            <tr>
              <td>${res.parameters?.ITNO}</td>
              <td>${res.parameters?.BANO}</td>
              <td>${res.parameters?.WHSL}</td>
              <td class="qty">${res.parameters?.ALQT}</td>
              <td>${res.parameters?.RIDN}</td>
              <td>${res.parameters?.RIDL}</td>
              <td class="error">${res.errorMessage ?? ''}</td>
            </tr>
            `
      }
    }

    html += `
      </tbody>
    </table>
    `

    await new H5Dialog('Cut from Stock').message(html).type(error ? 'Error' : 'Success').show()

    if (!error) {
      const firstLine = this.orderLines?.at(0)
      this.controller.SetValue('W1OBKV', firstLine.warehouse)
      this.controller.SetValue('W2OBKV', firstLine.reqDelDate)
      this.controller.SetValue('W3OBKV', firstLine.customerNumber)
      this.controller.SetValue('W4OBKV', firstLine.orderNumber)
      this.controller.SetValue('W5OBKV', firstLine.lineNumber)
      this.controller.PressKey('F5')
    }
  }


  protected async adjustStockBeamOff() {
    const req: IMIRequest = {
      program: "MMS850MI",
      transaction: 'AddAdjust',
      record: {
        PRFL: '*EXE',
        E0PA: "WS",
        E065: "WMS",
        WHLO: this.warehouse,
        ITNO: this.itemNumber.getString(),
        WHSL: this.location.getString(),
        BANO: this.lotNumber.getString(),
        STAS: this.status.getString(),
        QLQT: numeral(this.cutQty.getString()).value() * -1,
        STAG: '2',
        BREF: this.orderLines?.at(0)?.orderNumber,
        RSCD: 'CFS',
        RESP: this.userId
      },
      includeMetadata: true
    }
    return await this.bulkM3API.executeRequest([req])
  }

  protected async adjustOrderedBeamOn() {
    let mul = 1
    let lineCount = this.orderLines.length
    if (lineCount === 1) {
      mul = 2
    }
    const reqs: IMIRequest[] = this.orderLines.map(line => ({
      program: "MMS850MI",
      transaction: 'AddAdjust',
      record: {
        PRFL: '*EXE',
        E0PA: "WS",
        E065: "WMS",
        WHLO: line.warehouse,
        ITNO: line.itemNumber,
        WHSL: this.location.getString(),
        BANO: this.lotNumber.getString(),
        STAS: this.status.getString(),
        ALOC: '1',
        QLQT: numeral(this.cutQty.getString()).value() * mul,
        STAG: '2',
        BREF: line.orderNumber,
        RSCD: 'CFS',
        RESP: this.userId
      },
      includeMetadata: true,
    }))

    return await this.bulkM3API.executeRequest(reqs)
  }

  protected async getAllocationMethod() {
    let allocationMethod = ''
    const req: IMIRequest = {
      program: "MMS200MI",
      transaction: "GetItmWhsBasic",
      record: {
        WHLO: this.warehouse,
        ITNO: this.itemNumber.getString()
      },
      outputFields: ["ALMT"]
    }
    const res = await M3API.executeRequest(req)
    allocationMethod = res.item.ALMT
    return allocationMethod;
  }

  protected async updateAllocationMethod(allocationMethod: string) {
    const itemNumbers = Array.from(new Set(this.orderLines.map(line => line.itemNumber)).values())
    
    const reqs: IMIRequest[] = itemNumbers.map(itemNumber => ({
      program: "MMS200MI",
      transaction: "UpdItmWhs",
      record: {
        WHLO: this.warehouse,
        ITNO: itemNumber,
        ALMT: allocationMethod
      },
      includeMetadata: true
    }))
    return await this.bulkM3API.executeRequest(reqs)
  }

  protected async allocateOrder() {
    let mul = 1
    let lineCount = this.orderLines.length
    if (lineCount === 1) {
      mul = 2
    }
    const reqs: IMIRequest[] = this.orderLines.map(line => ({
      program: 'MMS120MI',
      transaction: 'UpdDetAlloc',
      record: {
        CONO: this.company,
        WHLO: this.warehouse,
        ITNO: line.itemNumber,
        WHSL: this.location.getString(),
        BANO: this.lotNumber.getString(),
        ALQT: numeral(this.cutQty.getString()).value() * mul,
        TTYP: '31',
        RIDN: line.orderNumber,
        RIDL: line.lineNumber
      },
      includeMetadata: true,
    }))
    return await this.bulkM3API.executeRequest(reqs)
  }

}

module.exports = CutFromStock

function debounce(func, delay) {
  let timeout; // This variable will hold the timer ID

  return function (...args) { // Returns a new function that will be called
    const context = this; // Capture the 'this' context

    clearTimeout(timeout); // Clear any existing timer

    timeout = setTimeout(() => { // Set a new timer
      func.apply(context, args); // Execute the original function after the delay
    }, delay);
  };
}
