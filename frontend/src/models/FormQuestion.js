/**
 * FormQuestion model class
 */
export class FormQuestion {
  constructor (data = {}) {
    this.id = data.id || null
    this.typeId = data.typeId || null
    this.text = data.text || ''
    this.required = data.required || false
    this.options = data.options || null
    this.eventId = data.eventId || null
  }

  /**
   * Question type constants
   */
  static get QUESTION_TYPES () {
    return {
      TEXT: 1,
      TEXTAREA: 2,
      SELECT: 3,
      RADIO: 4,
      CHECKBOX: 5,
      EMAIL: 6,
      PHONE: 7,
      DATE: 8,
      NUMBER: 9,
    }
  }

  /**
   * Get question type name
   */
  getTypeName () {
    switch (this.typeId) {
      case FormQuestion.QUESTION_TYPES.TEXT: {
        return 'Text Input'
      }
      case FormQuestion.QUESTION_TYPES.TEXTAREA: {
        return 'Text Area'
      }
      case FormQuestion.QUESTION_TYPES.SELECT: {
        return 'Dropdown Select'
      }
      case FormQuestion.QUESTION_TYPES.RADIO: {
        return 'Radio Buttons'
      }
      case FormQuestion.QUESTION_TYPES.CHECKBOX: {
        return 'Checkboxes'
      }
      case FormQuestion.QUESTION_TYPES.EMAIL: {
        return 'Email Input'
      }
      case FormQuestion.QUESTION_TYPES.PHONE: {
        return 'Phone Input'
      }
      case FormQuestion.QUESTION_TYPES.DATE: {
        return 'Date Input'
      }
      case FormQuestion.QUESTION_TYPES.NUMBER: {
        return 'Number Input'
      }
      default: {
        return 'Unknown Type'
      }
    }
  }

  /**
   * Check if question is required
   */
  isRequired () {
    return this.required === true
  }

  /**
   * Check if question has options
   */
  hasOptions () {
    return this.options && Array.isArray(this.options) && this.options.length > 0
  }

  /**
   * Get options array
   */
  getOptions () {
    if (!this.hasOptions()) {
      return []
    }
    return this.options
  }

  /**
   * Check if question type supports options
   */
  supportsOptions () {
    const typesWithOptions = [
      FormQuestion.QUESTION_TYPES.SELECT,
      FormQuestion.QUESTION_TYPES.RADIO,
      FormQuestion.QUESTION_TYPES.CHECKBOX,
    ]
    return typesWithOptions.includes(this.typeId)
  }

  /**
   * Check if question type is text-based
   */
  isTextBased () {
    const textTypes = [
      FormQuestion.QUESTION_TYPES.TEXT,
      FormQuestion.QUESTION_TYPES.TEXTAREA,
      FormQuestion.QUESTION_TYPES.EMAIL,
    ]
    return textTypes.includes(this.typeId)
  }

  /**
   * Check if question type is choice-based
   */
  isChoiceBased () {
    const choiceTypes = [
      FormQuestion.QUESTION_TYPES.SELECT,
      FormQuestion.QUESTION_TYPES.RADIO,
      FormQuestion.QUESTION_TYPES.CHECKBOX,
    ]
    return choiceTypes.includes(this.typeId)
  }

  /**
   * Check if question type is numeric
   */
  isNumeric () {
    return this.typeId === FormQuestion.QUESTION_TYPES.NUMBER
  }

  /**
   * Check if question type is date
   */
  isDate () {
    return this.typeId === FormQuestion.QUESTION_TYPES.DATE
  }

  /**
   * Validates the form question data
   */
  validate () {
    const errors = []

    if (!this.typeId) {
      errors.push('Question type is required')
    }

    if (!this.text || this.text.trim().length === 0) {
      errors.push('Question text is required')
    }

    if (this.text && this.text.length > 1000) {
      errors.push('Question text must be 1000 characters or less')
    }

    if (this.typeId && !Object.values(FormQuestion.QUESTION_TYPES).includes(this.typeId)) {
      errors.push('Invalid question type')
    }

    if (this.supportsOptions() && !this.hasOptions()) {
      errors.push('Options are required for this question type')
    }

    if (!this.supportsOptions() && this.hasOptions()) {
      errors.push('Options are not supported for this question type')
    }

    if (!this.eventId) {
      errors.push('Event ID is required')
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * Returns a plain object (for API requests/responses)
   */
  toJSON () {
    return {
      id: this.id,
      typeId: this.typeId,
      text: this.text,
      required: this.required,
      options: this.options,
      eventId: this.eventId,
    }
  }
}
