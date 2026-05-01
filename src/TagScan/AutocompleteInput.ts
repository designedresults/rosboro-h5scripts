import { hideLoading, showLoading } from "@designedresults/h5-script-plus";

export default class AutocompleteInput {

  private cache: { [key: string]: AutocompleteItem[] } = {}
  private cacheSelectedItems: any = {}
  private currentSearchTerm = ''

  constructor(
    private element: JQuery<HTMLElement>,
    autocompleteSource: (searchTerm: string) => Promise<AutocompleteItem[]>,
    onSelect?: (item: AutocompleteItem) => void) {

    const options = {
      autoFocus: true,
      delay: 400,
      minLength: 3,
      source: (search: AutocompleteSearchTerm, response: (items: AutocompleteItem[]) => void) => {
        const searchTerm = search.term.toUpperCase();
        if (searchTerm in this.cacheSelectedItems) {
          return response(this.cache[this.cacheSelectedItems[searchTerm]]);
        }
        if (searchTerm in this.cache) {
          return response(this.cache[searchTerm]);
        }
        this.currentSearchTerm = searchTerm;

        const loadingId = showLoading(element)
        autocompleteSource(searchTerm).then(results => {
          this.cache[searchTerm] = results
          return response(results)
        }).catch(err => {
          console.error(err)
          return response([])
        }).finally(() => {
          hideLoading(loadingId)
        })

      },
      focus: () => {
        return false;
      },
      select: (event: Event, ui: { item: AutocompleteItem }) => {
        const { label, value } = ui.item;
        this.cacheSelectedItems[value] = this.currentSearchTerm;
        if (this.element) {
          $(this.element).val(value)
        }
        if (onSelect) {
          onSelect(ui.item)
        }
        return false;
      },
    };
    //@ts-ignore
    const widget = $.ui.autocomplete(options, element);
    widget.menu.element.css({
      'max-height': `120px`,
      'overflow-y': 'overlay',
      'overflow-x': 'hidden',
      'font-family': 'source sans pro",helvetica,arial,sans-serif',
      'z-index': '2000',
      height: 'auto',
      'max-width': '400px',
    });
    this.extendWidget(widget)

  }

  private extendWidget(widget: any) {

    widget._renderItem = function (ul: HTMLUListElement[], item: AutocompleteItem) {
      const style = (extra = '') => `style = "font-size:1.6em; ${extra}"`;
      const div = $('<div>');
      const labels = item.label
        .split(' --- ')
        .map((label: string) => String(label).replace(new RegExp(this.term, 'gi'), '<strong>$&</strong>'));
      let listItem = `<p class="listview-micro" ${style('font-weight:400')}> ${labels[0]} </p>`

      $(listItem).appendTo(div);
      return $('<li>')
        .attr('data-value', item.value)
        .attr('style', 'max-width:400px; padding:0; left: 0')
        .append(div)
        .appendTo(ul);
    };
    widget.option('position', {
      my: 'left top',
      at: 'left bottom',
      collision: 'flip',
    });
    const Menu = widget.menu;
    const oldActiveClass = 'ui-state-active';
    const newActiveClass = 'is-selected';
    Menu.element.addClass(['listview']);
    Menu._addClass = function (u: any, v: any, C: any) {
      if (C && C.includes(oldActiveClass)) {
        C = C.replace(oldActiveClass, newActiveClass);
        u = this.active || this.element.children().first();
      }
      return this._toggleClass(u, v, C, !0);
    };
    Menu._removeClass = function (u: any, v: any, C: any) {
      if (C && C.includes(oldActiveClass)) {
        C = C.replace(oldActiveClass, newActiveClass);
        u = this.element.children(`.${newActiveClass}`);
      }
      return this._toggleClass(u, v, C, !1);
    };
    return widget;
  }

}



type AutocompleteSearchTerm = {
  term: string
}

type AutocompleteItem = {
  value: string,
  label: string
}

