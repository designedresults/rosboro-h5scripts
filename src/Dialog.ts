type DialogType =  "Question" | "Information" | "Warning" | "Error" | "Success" | "Alert"

export default class Dialog {

  private withCancelButton = false
  private dialogType: "Question" | "Information" | "Warning" | "Error" | "Success" | "Alert" = "Information"

  constructor (private titleValue?: string, private messageValue?: string) {

  }

  public title(title: string) {
    this.titleValue = title
    return this
  }
  public message(message: string) {
    this.messageValue = message
    return this
  }

  public withCancel() {
    this.withCancelButton = true
    return this
  }


  public type(type: DialogType) {
    this.dialogType = type
    return this
  }

  public error() {
    this.dialogType = "Error"
    return this
  }

  

  public show() {
    return new Promise((res, rej) => {
      var self = this
      // Create the dialog content
      var dialogContent = $(`<div><label class='inforLabel noColon'>${this.messageValue}</label></div>`)
      var dialogButtons = []
      dialogButtons.push({
        text: 'OK',
        isDefault: true,
        width: 80,
        click: function (event, model) {
          res(true)
          if (ScriptUtil.version >= 2.0) {
            model.close(true)
          } else {
            $(this).inforDialog('close')
          }
          //@ts-ignore
          self.isDialogShown = true
          //@ts-ignore
          if (self?.pressEnterAsync) {
            //@ts-ignore
            self?.pressEnterAsync()
          }
        },
      })
      if (this.withCancelButton) {
        dialogButtons.push({
          text: 'Cancel',
          width: 80,
          click: function (event, model) {
            res(false)
            if (ScriptUtil.version >= 2.0) {
              model.close(true)
            } else {
              $(this).inforDialog('close')
            }
          },
        })
      }

      var dialogOptions = {
        title: this.titleValue,
        dialogType: this.dialogType,
        modal: true,
        width: 600,
        minHeight: 480,
        withCancel: true,
        closeOnEscape: true,
        close: function () {
          res(false)
          dialogContent.remove()
        },
        buttons: dialogButtons,
      }

      // Show the dialog
      if (ScriptUtil.version >= 2.0) {
        H5ControlUtil.H5Dialog.CreateDialogElement(dialogContent[0], dialogOptions)
      } else {
        dialogContent.inforMessageDialog(dialogOptions)
      }
    })
  }
}
