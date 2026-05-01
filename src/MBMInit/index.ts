/**
 * Sends an MBMInitiator message
 * 
 * @M3API MNS260MI/AddMBMInit
 * @M3API MNS260MI/PrcMBMInit
 */
export default class MBMInit {
  public static async sendMBM(mbm: IMBMInit) {
    await this.addMBMInit(mbm)
    await this.prcMBMInit(mbm)
  }
  protected static async addMBMInit(mbm: IMBMInit) {
    const record = {
      ARSD: mbm.automaticResend,
      DONR: mbm.documentNumber,
      DOVA: mbm.documentVariant,
      PRF1: mbm.mediaCtrl1,
      PRF2: mbm.mediaCtrl2,
      PRTF: mbm.printerFile,
      CPPL: mbm.copy,
      OBJC: mbm.field,
      DONO: mbm.documentIdentity,
      MKF4: mbm.messageKey4Field,
      MKV4: mbm.messageKey4Value,
      MKF5: mbm.messageKey5Field,
      MKV5: mbm.messageKey5Value,
      MKF6: mbm.messageKey6Field,
      MKV6: mbm.messageKey6Value,
      MKF7: mbm.messageKey7Field,
      MKV7: mbm.messageKey7Value,
    }
    const request: IMIRequest = {
      program: 'MNS260MI',
      transaction: 'AddMBMInit',
      record,
    }
    const resp = (await MIService.Current.executeRequest(request)) as IMIResponse
    if (resp.error) {
      throw resp.errorMessage
    }
    mbm.mbmName = resp?.item?.BMIN
  }
  protected static async prcMBMInit(mbm: IMBMInit) {
    const record = {
      BMIN: mbm.mbmName
    }
    const request: IMIRequest = {
      program: 'MNS260MI',
      transaction: 'PrcMBMInit',
      record,
    }
    const resp = (await MIService.Current.executeRequest(request)) as IMIResponse
    if (resp.error) {
      throw resp.errorMessage
    }
  }
}

/**
 * @interface
 */
export interface IMBMInit {
  mbmName?: string
  automaticResend?: string
  documentNumber: string
  documentVariant?: string
  mediaProfile?: string
  mediaCtrl1: string
  mediaCtrl2?: string
  printerFile: string
  copy?: string
  field: string
  documentIdentity: string
  messageKey4Field?: string
  messageKey4Value?: string
  messageKey5Field?: string
  messageKey5Value?: string
  messageKey6Field?: string
  messageKey6Value?: string
  messageKey7Field?: string
  messageKey7Value?: string
}
