import { M3API } from '@designedresults/h5-script-plus'
import numeral from 'numeral'

export type AttributeServiceInitArgs = {
  itemNumber?: string
  lotNumber?: string
  orderCategory?: string
  orderNumber?: string
  orderLine?: string
}

export default class AttributeService {
  private controller: IInstanceController
  private args: AttributeServiceInitArgs
  private attributeNumber: string
  private gridAttributes: Map<string, Attribute>

  constructor(controller: IInstanceController, args: AttributeServiceInitArgs, attributeNumber: string) {
    this.controller = controller
    this.args = args
    this.attributeNumber = attributeNumber
    this.gridAttributes = this.getGridAttributes()
  }

  public static async init(controller: IInstanceController, args: AttributeServiceInitArgs) {
    const attributeNumber = await this.getAttributeNumber(args)
    return new AttributeService(controller, args, attributeNumber)
  }


  private static async getAttributeNumber(args: AttributeServiceInitArgs) {
    let attributeNumber = ''

    if (args.orderCategory === '311') {
      attributeNumber = await this.getCOLineAttributeNumber(args.orderNumber, args.orderLine)
    } else if (args.orderCategory === '101') {
      attributeNumber = await this.getMOAttributeNumber(args.itemNumber, args.orderNumber)
    }
    return attributeNumber
  }

  public static async getCOLineAttributeNumber(orderNumber: string, orderLine: string) {
    const req: IMIRequest = {
      program: 'OIS100MI',
      transaction: 'GetLine',
      record: {
        ORNO: orderNumber,
        PONR: orderLine
      },
      outputFields: ['ATNR']
    }
    const res = await M3API.executeRequest(req)
    return res.item?.ATNR
  }

  public static async getMOAttributeNumber(itemNumber: string, orderNumber: string) {
    const req: IMIRequest = {
      program: 'EXPORTMI',
      transaction: 'Select',
      record: {
        QERY: `VHATNR from MWOHED where VHPRNO = ${itemNumber} and VHMFNO = ${orderNumber}`
      }
    }
    const res = await M3API.executeRequest(req)
    return res.item?.REPL
  }

  private getGridAttributes() {
    if (!this.controller) {
      throw new Error("Controller is undefined")
    }
    if (!this.attributeNumber) {
      throw new Error("AttributeNumber is undefined")
    }
    const map: Map<string, Attribute> = new Map()

    const rows = ListControl.ListView.GetDatagrid(this.controller).getData() as any[]
    rows.forEach(row => {
      const stringValue = row.WSATAV?.trim()
      const attr: Attribute = {
        id: row.WSATID?.trim(),
        name: '',
        attributeNumber: this.attributeNumber,
        stringValue,
        numericValue: numeral(stringValue).value()
      }
      map.set(attr.id, attr)
    })

    return map
  }

  public async updateAttribute(attr: Attribute) {
    try {
      await this.setAttrValue(attr)
    } catch (err) {
      await this.addAttr(attr)
    }
  }

  private async addAttr(attr: Attribute) {
    const req: IMIRequest = {
      program: 'ATS101MI',
      transaction: 'AddAttr',
      record: {
        ATNR: attr.attributeNumber,
        ATID: attr.id,
        ATAV: attr.stringValue
      },
      outputFields: ['ATNR']
    }
    const res = await M3API.executeRequest(req)
    return res.item?.ATNR
  }

  private async setAttrValue(attr: Attribute) {
    const req: IMIRequest = {
      program: 'ATS101MI',
      transaction: 'SetAttrValue',
      record: {
        ATNR: attr.attributeNumber,
        ATID: attr.id,
        ATAV: attr.stringValue
      },
      outputFields: ['ATNR']
    }
    const res = await M3API.executeRequest(req)
    return res.item?.ATNR
  }

}


type Attribute = {
  id: string
  name: string
  attributeNumber: string
  stringValue: string
  numericValue: number
}