import { BulkM3API, ComboBox, CSRF, Label, M3API, TextInput } from '@designedresults/h5-script-plus'
export class SearchSupplier {
  private controller: IInstanceController
  private top: number = 5
  private left: number = 36
  private textInput?: TextInput
  private comboBox?: ComboBox
  private bulkM3API: BulkM3API


  constructor(scriptArgs: IScriptArgs) {
    this.controller = scriptArgs.controller
    this.bulkM3API = new BulkM3API(new CSRF())
  }

  public static Init(args: IScriptArgs): void {
    new SearchSupplier(args).run()
  }

  private async run() {
    const search = debounce(this.search.bind(this), 200)
    new Label(this.controller)
      .name('lbl-SearchSupplier')
      .value('Search Supplier Names')
      .position(this.top, this.left)
      .bold()
      .build()
    this.textInput = new TextInput(this.controller)
      .name('txt-searchSupplier')
      .value('')
      .position(this.top + 1, this.left)
      .width(20)
      .enabled(true)
      .build()
    this.textInput.onInput(e => {
      const term = e.target.value
      search(term.toUpperCase())
    })
  }

  private async search(term: string) {
    this.textInput?.showLoading()
    if (!term) {
      this.comboBox?.remove()
    } else {
      const [supplierSearch, extFieldSearch] = await Promise.all([
        this.searchSupplier(term),
        this.searchExtFields(term),
      ])

      const results: ComboBoxItemElement[] = []
      const data = new Map<string, string>()
      supplierSearch.forEach(s => data.set(s.SUNO, s.SUNM))
      extFieldSearch.forEach(s => data.set(s.SUNO, s.A121))

      for (const id of Array.from(data.keys()).sort()) {
        const name = data.get(id);
        const item = new ComboBoxItemElement()
          item.Value = id
          item.Text = `${id} - ${name}`
          results.push(item)
      }

      if (results.length > 0) {
        if (results[0]) {
          results[0].IsSelected = true
        }
        this.controller.SetValue('WASUNO', results[0].Value)
      }

      this.comboBox?.remove()
      this.comboBox = await new ComboBox(this.controller)
        .name('cbx-Suppliers')
        .value('')
        .position(this.top + 2, this.left)
        .width(20)
        .items(results)
        .build()
      this.comboBox.onChange(e => {
        const value = e.target.value
        this.controller.SetValue('WASUNO', value)
      })
    }
    this.textInput?.hideLoading()
  }

  private async searchSupplier(term: string): Promise<{ SUNO: string; SUNM: string }[]> {
    try {
      const resp = await M3API.executeRequest(
        {
          program: 'CRS620MI',
          transaction: 'SearchSupplier',
          record: { SQRY: `SUNM:*${term}*` },
          outputFields: ['SUNO', 'SUNM'],
        },
        'SupplierSearch'
      )
      return resp?.items ?? []
    } catch (err) {
      return []
    }
  }

  private async searchExtFields(term: string) {
    try {
      const req: IMIRequest = {
        program: 'EXPORTMI',
        transaction: 'Search',
        record: {
          FILE: 'CUGEX1',
          FLDS: 'F1PK01, F1A121',
          SEPC: '|',
          SQRY: `FILE:CIDMAS AND A121:*${term}*`,
        },
      }
      const resp = await M3API.executeRequest(req, 'SupplierSearchExt')
      return (
        resp?.items?.map(item => ({
          SUNO: item.REPL.split('|')[0],
          A121: item.REPL.split('|')[1],
        })) ?? []
      )
    } catch (err) {
      return []
    }
  }

  private async getSupplierNames(ids: string[]) {
    try {
      const reqs: IMIRequest[] = ids.map(id => ({
        program: 'CRS620MI',
        transaction: 'GetBasicData',
        record: { SUNO: id },
        outputFields: ['SUNM'],
      }))
      const resps = await this.bulkM3API.executeRequest(reqs)
      return (
        resps.results.map(res => ({
          SUNO: res.parameters?.SUNO,
          SUNM: res.records?.at(0)?.SUNM,
        })) ?? []
      )
    } catch (err) {
      return []
    }
  }
}

module.exports = SearchSupplier

//@ts-ignore
function debounce(func, delay) {
  //@ts-ignore
  let timeoutId

  //@ts-ignore
  return function (...args) {
    //@ts-ignore
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      //@ts-ignore
      func.apply(this, args)
    }, delay)
  }
}
