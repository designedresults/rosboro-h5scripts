class MWS068B_KilnLocations {
  private controller: IInstanceController

  private top: number = 1
  private left: number = 0

  constructor(scriptArgs: IScriptArgs) {
    this.controller = scriptArgs.controller
  }

  public static Init(args: IScriptArgs): void {
    new MWS068B_KilnLocations(args).run()
  }

  private async run() {
    
    const sortingOrder = this.controller.GetSortingOrder()
  
    if (sortingOrder === '45') {
      this.addLocationButton('Rough Green', 'RG MILLA', 'RG MILLB')
      this.left += 10

      this.addLocationButton('K1N Stage', 'K1N1', 'K1N4')
      this.left += 7
      this.addLocationButton('K1S Stage', 'K1S1', 'K1S4')
      
      this.left += 8
      this.addLocationButton('K2N Stage', 'K2N1', 'K2N4')
      this.left += 7
      this.addLocationButton('K2S Stage', 'K2S1', 'K2S4')

      this.left += 8
      this.addLocationButton('K3N Stage', 'K3N1', 'K3N4')
      this.left += 7
      this.addLocationButton('K3S Stage', 'K3S1', 'K3S4')

      this.left += 8
      this.addLocationButton('K4N Stage', 'K4N1', 'K4N4')
      this.left += 7
      this.addLocationButton('K4S Stage', 'K4S1', 'K4S4')

      this.left += 15
      this.addLocationButton('K5 Stage', 'K5 STAGE', 'K5 STAGE')
      this.left += 7
      this.addLocationButton('K6 Stage', 'K6 STAGE', 'K6 STAGE')
      this.left += 7
      this.addLocationButton('K7 Stage', 'K7 STAGE', 'K7 STAGE')
      this.left += 7
      this.addLocationButton('K8 Stage', 'K8 STAGE', 'K8 STAGE')
      this.left += 7
      this.addLocationButton('K9 Stage', 'K9 STAGE', 'K9 STAGE')




      this.top = 2
      this.left = 0
      this.addLocationButton('Rough Dry', 'RD LUMBER', 'RD LUMBER')
      this.left = 10
      this.addLocationButton('K1N WIP', 'K1N WIP', 'K1N WIP')
      this.left += 7
      this.addLocationButton('K1S WIP', 'K1S WIP', 'K1S WIP')
      this.left += 8
      this.addLocationButton('K2N WIP', 'K2N WIP', 'K2N WIP')
      this.left += 7
      this.addLocationButton('K2S WIP', 'K2S WIP', 'K2S WIP')
      this.left += 8
      this.addLocationButton('K3N WIP', 'K3N WIP', 'K3N WIP')
      this.left += 7
      this.addLocationButton('K3S WIP', 'K3S WIP', 'K3S WIP')
      this.left += 8
      this.addLocationButton('K4N WIP', 'K4N WIP', 'K4N WIP')
      this.left += 7
      this.addLocationButton('K4S WIP', 'K4S WIP', 'K4S WIP')
      

      this.left += 15
      this.addLocationButton('K5 WIP', 'K5 WIP', 'K5 WIP')
      this.left += 7
      this.addLocationButton('K6 WIP', 'K6 WIP', 'K6 WIP')
      this.left += 7
      this.addLocationButton('K7 WIP', 'K7 WIP', 'K7 WIP')
      this.left += 7
      this.addLocationButton('K8 WIP', 'K8 WIP', 'K8 WIP')
      this.left += 7
      this.addLocationButton('K9 WIP', 'K9 WIP', 'K9 WIP')
      



    }

  }

  protected addLocationButton(name: string, from: string, to: string) {
    const btn: IButtonElement = new ButtonElement()
    btn.Position = new PositionElement()
    btn.Position.Top = this.top
    btn.Position.Left = this.left
    btn.Name = "btn-" + name.replace(" ", "-")
    btn.Value = name
    const el = this.controller.GetContentElement().AddElement(btn)
    $(el).on('click', () => {
      this.controller.SetValue('WFSLCT', from)
      this.controller.SetValue('WTSLCT', to)
      setTimeout(() => {
        this.controller.PressKey('F5')
      }, 200)
      
    })
  }

}

module.exports = MWS068B_KilnLocations
