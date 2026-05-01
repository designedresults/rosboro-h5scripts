import { ActionButton, H5Dialog, Label, M3API, NumberInput } from '@designedresults/h5-script-plus'
import numeral from "numeral"
/**
 * Allow entry of either Camber (in inches) or Radius (in feet)
 * 
 * @M3Program ATS101
 * @M3Panel G
 * 
 * * Sorting option must be `12`
 * * Supported attribute models are `BEAM_NS` and `BEAM_NS_SB`
 * * If attribute `CAMBER` value is `ENTER VALUE`, then text in attribute `CAMBERVALUE` will be parsed
 * * Attribute values `RADIUS_FT` and `CAMBER_IN` will be updated with the proper values
 * * Additional input boxes area added in the heading section that allow conversion between camber (in inches) or radius (in feet).
 * * Length used for conversions will be pulled from the MMS001 (ILEN) Length.
 * 
 */
export class Camber {
  private controller: IInstanceController
  private datagrid: IActiveGrid
  private log: IScriptLog

  private length?: NumberInput
  private radius?: NumberInput
  private camber?: NumberInput

  constructor(scriptArgs: IScriptArgs) {
    this.controller = scriptArgs.controller
    this.datagrid = ListControl.ListView.GetDatagrid(scriptArgs.controller)

    this.log = scriptArgs.log
    if (scriptArgs.args.endsWith('!DEBUG')) {
      this.log.SetDebug()
    }
    if (scriptArgs.args.endsWith('!TRACE')) {
      this.log.SetTrace()
    }
  }

  public static Init(args: IScriptArgs): void {
    new Camber(args).run()
  }

  private async run() {
    if (this.controller.GetSortingOrder() !== '12') {
      return
    }
    const { attributeModel } = await this.getItem()
    if (attributeModel === 'BEAM_NS' || attributeModel === 'BEAM_NS_SB') {
      this.addUI()
    }
  }

  private async addUI() {

    let x = 60
    let y = 2

    const initialValues = await this.init()

    new Label(this.controller).name('lbl-length').value(`Length (FT)`).position(y, x).build()
    this.length = new NumberInput(this.controller)
      .name('txt-length')
      .value(numeral(initialValues?.length).format().toString())
      .width(4)
      .position(y, x + 9)
      .color('#000000')
      .backgroundColor('#eee')
      .build()
    this.length.disable()
    x += 16;


    new Label(this.controller).name('lbl-radius').value('Radius (FT)').position(y, x).build()
    this.radius = new NumberInput(this.controller).name('txt-radius').value(initialValues.currentRadius.toString()).width(8).position(y, x + 6).build()
    y++;


    new Label(this.controller).name('lbl-camber').value('Camber (IN)').position(y, x).build()
    this.camber = new NumberInput(this.controller).name('txt-camber').value(initialValues.currentCamber.toString()).width(8).position(y, x + 6).build()

    $(this.length.el).on('input', (e: any) => {
      const lengthValue = Number(e.target.value)
      const radiusValue = Number(this.radius.getString())
      const camberValue = this.calcCamber(lengthValue, radiusValue)
      if (Number(this.camber.getString()) !== camberValue) {
        this.camber.setString(camberValue.toString())
      }
    })
    $(this.radius.el).on('input', (e: any) => {
      const radiusValue = Number(e.target.value)
      const lengthValue = Number(this.length.getString())
      const camberValue = this.calcCamber(lengthValue, radiusValue)
      if (Number(this.camber.getString()) !== camberValue) {
        this.camber.setString(camberValue.toString())
      }
    })
    $(this.camber.el).on('input', (e: any) => {
      const camberValue = Number(e.target.value)
      const lengthValue = Number(this.length.getString())
      const radiusValue = this.calcRadius(lengthValue, camberValue)
      if (Number(this.radius.getString()) !== radiusValue) {
        this.radius.setString(radiusValue.toString())
      }
    })

    y++
    x += 8
    new ActionButton(this.controller)
      .name('btn-updateAttributes')
      .value('Update')
      .position(y, x)
      .action(async () => {
        const radiusValue = Number(this.radius.getString())
        const camberValue = Number(this.camber.getString())
        await this.updateAttributeValues(radiusValue, camberValue)
      })
      .build()

  }

  private async init() {
    const { length } = await this.getItem()

    // value should be either "5000", "0", or "ENTER VALUE"
    const standardRadius = this.getGridAttributeValue('CAMBER')
    const camberValue = this.getGridAttributeValue('CAMBERVALUE')

    const currentRadius = numeral(this.getGridAttributeValue('RADIUS_FT')).value()
    const currentCamber = numeral(this.getGridAttributeValue('CAMBER_IN')).value()

    let calculatedRadius = 0
    let calculatedCamber = 0

    let parsedRadius: number | undefined
    let parsedCamber: number | undefined
    const isStandardRadius = standardRadius === '0' || standardRadius === '5000'
    if (isStandardRadius) {

      if (camberValue) {
        // cambervalue should not be set if using a standard radius
        await this.updateAttributeValue('CAMBERVALUE', '')
      }

      this.log.Debug(`Standard radius = ${standardRadius}`)
      calculatedRadius = numeral(standardRadius).value()
      calculatedCamber = this.calcCamber(length, calculatedRadius)
      if (!this.matches(currentRadius, calculatedRadius, currentCamber, calculatedCamber)) {
        await this.updateAttributeValues(calculatedRadius, calculatedCamber)
        return
      }

    } else if (standardRadius === 'ENTER VALUE') {
      let parsedRadius = this.parseAsRadius()
      let parsedCamber = this.parseAsCamber()
      if (parsedRadius) {
        calculatedRadius = parsedRadius
        calculatedCamber = this.calcCamber(length, parsedRadius)
      } else if (parsedCamber) {
        calculatedRadius = this.calcRadius(length, parsedCamber)
        calculatedCamber = parsedCamber
      } else {
        // unable to parse value
        await new H5Dialog('Attribute value', `Unable to find radius in feet or camber in inches from "${camberValue ?? ''}"`).error().show()
        return { length, standardRadius, parsedRadius, parsedCamber, calculatedRadius, calculatedCamber, currentRadius, currentCamber }
      }
      if (!this.matches(currentRadius, calculatedRadius, currentCamber, calculatedCamber)) {
        const ok = await this.confirmUpdate({ length, currentRadius, calculatedRadius, parsedRadius, currentCamber, calculatedCamber, parsedCamber, camberValue })
        if (ok) {
          await this.updateAttributeValues(calculatedRadius, calculatedCamber)
          return
        }
      }
    } else {
      throw Error(`${standardRadius} is not supported`)
    }

    return { length, standardRadius, parsedRadius, parsedCamber, calculatedRadius, calculatedCamber, currentRadius, currentCamber }
  }


  private matches(currentRadius: number, radius: number, currentCamber: number, camber: number) {

    const radiusMatches = this.roundRadius(currentRadius) === this.roundRadius(radius)
    const camberMatches = this.roundCamber(currentCamber) === this.roundCamber(camber)

    this.log.Debug(`Radius matches = ${radiusMatches}`)
    this.log.Debug(`Camber matches = ${camberMatches}`)
    const bothMatch = radiusMatches && camberMatches
    this.log.Debug(`Both match = ${bothMatch}`)
    return bothMatch
  }




  private async confirmUpdate(args: {
    length: number,
    currentRadius?: number, calculatedRadius?: number, parsedRadius?: number,
    currentCamber?: number, calculatedCamber?: number, parsedCamber?: number,
    camberValue?: string
  }) {
    const { length, currentRadius, calculatedRadius, parsedRadius, currentCamber, calculatedCamber, parsedCamber, camberValue } = args

    let html = ''
    if (parsedRadius) {
      html += `<div><b>Radius of ${numeral(parsedRadius).format("0")}' requested (${camberValue}) with length ${numeral(length).format()}'</b></div>`
    } else if (parsedCamber) {
      html += `<div><b>Camber of ${numeral(parsedCamber).format("0.000")}" requested (${camberValue}) with length ${numeral(length).format()}'</b></div>`
    }

    html += `
        <table style="max-width: 240px; margin-bottom: 20px">
          <thead>
            <tr>
              <th></th>
              <th style="text-align: right">Radius</th>
              <th style="text-align: right">Camber</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
        `
    html += `
        <tr>
          <td>Current</td>
          <td style="text-align: right">${numeral(currentRadius).format("0")}'</td>
          <td style="text-align: right">${numeral(currentCamber).format("0.000")}"</td>
          </tr>`
    html += `
          <tr>
          <td>Calculated</td>
          <td style="text-align: right">${numeral(calculatedRadius).format("0")}'</td>
          <td style="text-align: right">${numeral(calculatedCamber).format("0.000")}"</td>
          </tr>`
    html += `
          </tbody>
        </table>
        `

    if (currentRadius !== calculatedRadius) {
      html += `<div>Do you want to update the radius from ${numeral(currentRadius).format("0")} to ${numeral(calculatedRadius).format("0")}?</div>`
    }
    if (currentCamber !== calculatedCamber) {
      html += `<div>Do you want to update the camber from ${numeral(currentCamber).format("0.000")} to ${numeral(calculatedCamber).format("0.000")}?</div>`
    }
    this.log.Debug(`Confirming update...`)
    const ok = await new H5Dialog('Attribute value')
      .withCancel()
      .message(html)
      .show() as boolean
    this.log.Debug(`Confrim update = ${ok}`)
    return ok
  }

  private getCamberValueAttribute() {
    const str = this.getGridAttributeValue('CAMBERVALUE') as string
    const strSubDoubleQuote = str.replaceAll(`''`, `"`)
    this.log.Trace(`CAMBERVALUE = ${str}, CAMBERVALUE with quote replace = ${strSubDoubleQuote}`)
    return strSubDoubleQuote
  }


  private parseAsRadius() {
    let radius: number | undefined
    const str = this.getCamberValueAttribute()
    const match = new RegExp(/(\d+)('|FT)/g).exec(str)
    if (match) {
      radius = Number(match.at(1))
    }
    this.log.Trace(JSON.stringify({ fn: 'parseAsCamber', args: { str, match }, radius }))
    return radius
  }

  private parseAsCamber() {
    let camber: number | undefined
    const str = this.getCamberValueAttribute()
    let matchDecimal, matchFraction, whole, numerator, denomenator

    if (str.includes('/')) {
      matchFraction = new RegExp(/(\d*)(-|\s)?(\d+)\/(\d+)\s*("|IN)/g).exec(str)
      if (matchFraction) {
        whole = Number(matchFraction.at(1) ?? 0)
        numerator = Number(matchFraction.at(3) ?? 0)
        denomenator = Number(matchFraction.at(4) ?? 0)
        camber = whole + (numerator / denomenator)
      }
    }

    if (camber === undefined) {
      matchDecimal = new RegExp(/^([0-9]?[\,\.]?[0-9]+)?["|IN]/g).exec(str)
      if (matchDecimal) {
        camber = Number(matchDecimal.at(1))
      }
    }

    this.log.Trace(JSON.stringify({ fn: 'parseAsCamber', args: { str, matchDecimal, matchFraction, whole, numeral, denomenator }, camber }))
    return camber
  }

  private getGridAttributeValue(attributeId: string) {
    const rows = ListControl.ListView.GetDatagrid(this.controller).getData()
    const value = rows.find(r => r.WSATID === attributeId)?.WSATAV?.trim()
    this.log.Trace(`Attribute value ${attributeId} = ${value}`)
    return value
  }

  private getGridRowIndex(attributeId: string) {
    const rows = ListControl.ListView.GetDatagrid(this.controller).getData()
    const rowIndex = rows.findIndex(r => r.WSATID === attributeId)
    this.log.Trace(`Row index for attribute id ${attributeId} = ${rowIndex}`)
    return rowIndex
  }

  private async updateAttributeValues(radius: number, camber: number) {
    this.log.Debug(`Updating attribute values RADIUS_FT=${radius}, CAMBER_IN=${camber}`)
    await this.updateAttributeValue('RADIUS_FT', radius.toString())
    await this.updateAttributeValue('CAMBER_IN', camber.toString())
    this.controller.PressKey('ENTER')
  }

  private async updateAttributeValue(attributeId: string, value: string) {
    this.controller.ShowBusyIndicator()
    const rowIndex = this.getGridRowIndex(attributeId)
    await this.updateGridCell(rowIndex, 'AALF', '') // clear target values
    await this.updateGridCell(rowIndex, 'ATAV', value)
    await new Promise(r => setTimeout(r, 200))
    this.controller.HideBusyIndicator()
  }

  private async updateGridCell(row: number, colName: string, value: string) {

    const colIndex = ListControl.GetColumnIndexByName(colName)
    const inputs = $(this.datagrid.getRowElement(row)).find(`ids-data-grid-cell[aria-colindex=${colIndex + 1}]`).click().find('ids-input')
    if (inputs?.length) {
      const input = inputs[0] as HTMLInputElement
      input.value = value
      input.blur()
    }
  }


  private getItemNumber() {
    const value = this.controller.GetValue('WWITNO')
    this.log.Trace(`Item number (WWITNO) = ${value}`)
    return value
  }


  private async getItem() {
    const req: IMIRequest = {
      program: 'MMS200MI',
      transaction: 'GetItmBasic',
      record: {
        ITNO: this.getItemNumber(),
      },
      outputFields: ['ILEN', 'ATMO'],
    }
    const res = await M3API.executeRequest(req, "ATS101G_Camber")
    this.log.Trace(JSON.stringify({ req, res }))
    return { length: res.item?.ILEN, attributeModel: res.item?.ATMO }
  }

  private calcRadius(length: number, camber: number) {
    if (!camber) {
      return 0
    }
    let value = (Math.pow(length, 2) * 1.5) / camber
    value = this.roundRadius(value)
    this.log.Trace(JSON.stringify({ fn: 'calcRadius', args: { length, camber }, value }))
    return value
  }

  private roundRadius(value: number) {
    return Math.round(value / 100) * 100
  }


  private calcCamber(length: number, radius: number) {
    if (!radius) {
      return 0
    }
    let value = (Math.pow(length, 2) * 1.5) / radius
    value = this.roundCamber(value)
    this.log.Trace(JSON.stringify({ fn: 'calcCamber', args: { length, radius }, value }))
    return value
  }

  private roundCamber(value: number) {
    return Math.round(value / .125) * .125
  }


}


module.exports = Camber
