export class EventConfig {
  constructor (data = {}) {
    this.isAllDay = data.isAllDay ?? false
    this.isSingleDayEvent = data.isSingleDayEvent ?? true
    this.maxTicketsPerRegistration = data.maxTicketsPerRegistration ?? 2
    this.saveAllAttendeesDetails = data.saveAllAttendeesDetails ?? false
    this.dateFormat = data.dateFormat ?? 'MM/DD/YYYY HH:mm'
    this.showEndTime = data.showEndTime ?? false
    this.enableMerchandiseShop = data.enableMerchandiseShop ?? false
    this.shippingRates = data.shippingRates ?? { delivery: 500, pickup: 0 }
    this.shippingFee = data.shippingFee ?? 5
    this.disableDelivery = data.disableDelivery ?? true
    this.enableAbandonedCartEmails = data.enableAbandonedCartEmails ?? false
    this.enableOnSiteQuota = data.enableOnSiteQuota ?? false
    this.defaultOnSiteQuota = data.defaultOnSiteQuota ?? 0
    this.defaultLowStockThreshold = data.defaultLowStockThreshold ?? 5
    this.paymentMethods = data.paymentMethods ?? ['stripe']
  }

  toJSON () {
    return {
      isAllDay: this.isAllDay,
      isSingleDayEvent: this.isSingleDayEvent,
      maxTicketsPerRegistration: this.maxTicketsPerRegistration,
      saveAllAttendeesDetails: this.saveAllAttendeesDetails,
      dateFormat: this.dateFormat,
      showEndTime: this.showEndTime,
      enableMerchandiseShop: this.enableMerchandiseShop,
      shippingRates: this.shippingRates,
      shippingFee: this.shippingFee,
      disableDelivery: this.disableDelivery,
      enableAbandonedCartEmails: this.enableAbandonedCartEmails,
      enableOnSiteQuota: this.enableOnSiteQuota,
      defaultOnSiteQuota: this.defaultOnSiteQuota,
      defaultLowStockThreshold: this.defaultLowStockThreshold,
      paymentMethods: this.paymentMethods,
    }
  }
}
