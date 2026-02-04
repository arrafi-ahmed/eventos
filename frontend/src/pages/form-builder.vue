<script setup>
  import { computed, onMounted, reactive, ref, toRaw } from 'vue'
  import { useI18n } from 'vue-i18n'

  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import FormItemsEditable from '@/components/FormItemsEditable.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { input_fields } from '@/utils'

  definePage({
    name: 'form-builder',
    meta: {
      layout: 'default',
      title: 'Form Builder',
      titleKey: 'pages.form_builder.title',
      requiresOrganizer: true,
      requiresAuth: true,
    },
  })

  const { xs } = useDisplay()
  const route = useRoute()
  const router = useRouter()
  const store = useStore()
  const { t } = useI18n()

  const newFormQuestions = ref([])

  const formItemTypes = reactive([...input_fields])
  const findFormItemTypeIndex = id => formItemTypes.findIndex(item => item.id == id)

  const dialog = ref(false)
  const selectedFormItemType = reactive({ id: null, title: null })

  const questionInit = {
    id: null,
    typeId: null,
    text: null,
    required: true,
    options: [],
  }
  const question = reactive({ ...questionInit })
  const isQuestionOptionsRequired = computed(() => {
    return selectedFormItemType.id != 0 && selectedFormItemType.id != 1
  })

  function openDialog (itemTypeId) {
    Object.assign(question, { ...questionInit, options: [] })
    dialog.value = !dialog.value
    const foundIndex = findFormItemTypeIndex(itemTypeId)
    Object.assign(selectedFormItemType, formItemTypes[foundIndex])
  }

  const formItemAdd = ref(null)
  const isFormItemAddValid = ref(true)

  async function addFormItem (selectedFormItemType) {
    await formItemAdd.value.validate()
    if (isQuestionOptionsRequired.value && question.options.length === 0) {
      isFormItemAddValid.value = false
    }
    if (!isFormItemAddValid.value) return

    question.typeId = selectedFormItemType.id
    if (selectedFormItemType.id == 0 || selectedFormItemType.id == 1) {
      delete question.options
    }

    newFormQuestions.value.push({ ...question })
    // newFormWQuestion.questions = newFormWQuestion.questions.concat(formItems);
    dialog.value = !dialog.value
  }

  const publishForm = ref(null)
  const isPublishFormValid = ref(true)

  const submitForm = ref(false)

  async function handleSubmitPublishForm () {
    await publishForm.value.validate()
    if (!isPublishFormValid.value) return

    submitForm.value = true
    store
      .dispatch('form/save', {
        formQuestions: toRaw(newFormQuestions.value),
        rmQIds,
        eventId: route.params.eventId,
      })
      .then(result => {
        router.push({
          name: 'dashboard-organizer',
        })
      })
      .finally(() => (submitForm.value = false))
  }

  const additionalAnswers = ref([])

  function handleUpdateAdditionalAnswers ({ newVal }) {
    additionalAnswers.value = newVal
  }

  const rmQIds = []

  function handleRemoveQuestion (qId, index) {
    if (qId) {
      const filteredQuestions = newFormQuestions.value.filter(item => item.id != qId)
      rmQIds.push(qId)
      newFormQuestions.value = [...filteredQuestions]
    } else {
      newFormQuestions.value.splice(index, 1)
    }
  }

  onMounted(() => {
    store
      .dispatch('form/setFormQuestions', {
        eventId: route.params.eventId,
      })
      .then(result => {
        Object.assign(newFormQuestions.value, { ...result })
        if (newFormQuestions.value[0] === null) newFormQuestions.value = []
      })
  })

  const event = computed(() => store.getters['event/getEventById'](route.params.eventId))
</script>

<template>
  <v-container class="form-builder-container">
    <!-- Header Section -->
    <PageTitle
      :subtitle="event?.name"
      title="Form Builder"
      :title-key="'pages.form_builder.title'"
    />

    <div class="d-flex justify-end">
      <v-menu>
        <template #activator="{ props }">
          <v-btn
            icon="mdi-plus"
            rounded
            v-bind="props"
            variant="tonal"
          />
        </template>
        <v-list density="compact">
          <v-list-item
            v-for="item in formItemTypes"
            :key="item.id"
            density="compact"
            link
            :title="item.title"
            @click="openDialog(item.id)"
          />
        </v-list>
      </v-menu>
    </div>

    <v-row>
      <v-col>
        <v-form
          ref="publishForm"
          v-model="isPublishFormValid"
          fast-fail
          @submit.prevent="handleSubmitPublishForm"
        >
          <div v-if="newFormQuestions && newFormQuestions.length > 0 && newFormQuestions[0]">
            <form-items-editable
              :key="`${newFormQuestions.length}`"
              :items="newFormQuestions"
              @remove="handleRemoveQuestion"
              @update="handleUpdateAdditionalAnswers"
            />
          </div>
          <div>
            <v-row
              class="mt-2 mt-md-4"
              justify="end"
            >
              <v-col cols="auto">
                <v-btn
                  color="primary"
                  :density="xs ? 'comfortable' : 'default'"
                  type="submit"
                >
                  Save
                </v-btn>
              </v-col>
            </v-row>
          </div>
        </v-form>
      </v-col>
    </v-row>
  </v-container>

  <v-dialog
    v-model="dialog"
    width="500"
  >
    <v-card density="compact">
      <v-card-title>
        <div class="d-flex align-center justify-lg-space-between">
          <span class="flex-grow-1">Add {{ selectedFormItemType?.title }}</span>
          <v-checkbox
            v-model="question.required"
            class="flex-grow-0"
            density="compact"
            hide-details
            label="Required?"
          />
        </div>
      </v-card-title>
      <v-card-text>
        <v-form
          ref="formItemAdd"
          v-model="isFormItemAddValid"
          fast-fail
          @submit.prevent="addFormItem(selectedFormItemType)"
        >
          <v-text-field
            v-model="question.text"
            clearable
            density="compact"
            hide-details="auto"
            label="Question Text"
            :rules="[(v) => !!v || 'Question Text is required!']"
          />

          <template v-if="isQuestionOptionsRequired">
            <v-row
              align="center"
              class="mt-2 mt-md-4"
            >
              <v-col cols="auto">
                <h4>Answer Options:</h4>
              </v-col>
              <v-col>
                <v-btn
                  density="comfortable"
                  icon="mdi-plus"
                  question
                  @click="question.options.push(null)"
                />
              </v-col>
            </v-row>
            <div class="mt-2 mt-md-4">
              <div
                v-for="(item, index) in question.options"
                :key="index"
                class="mt-1"
              >
                <v-text-field
                  v-model="question.options[index]"
                  clearable
                  density="compact"
                  hide-details="auto"
                  :label="`Option ${index + 1}`"
                  :rules="[(v) => !!v || `Option ${index + 1} is required!`]"
                />
              </div>
            </div>
          </template>

          <v-card-actions>
            <v-spacer />
            <v-btn
              color="primary"
              :density="xs ? 'comfortable' : 'default'"
              type="submit"
            >
              Submit
            </v-btn>
          </v-card-actions>
        </v-form>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped></style>
