<script setup>
  import { computed, onMounted, ref } from 'vue'

  import { useRoute } from 'vue-router'
  import { useStore } from 'vuex'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'

  definePage({
    name: 'event-statistics',
    meta: {
      layout: 'default',
      title: 'Event Statistics',
      requiresOrganizer: true,
      requiresAuth: true,
    },
  })

  const store = useStore()
  const route = useRoute()
  const { rounded } = useUiProps()

  const event = computed(() => store.getters['event/getEventById'](route.params.eventId))
  const statistics = computed(() => store.state.checkin.statistics)
  const inputDate = ref(null)

  function handleChangeDateStat (date) {
    store.dispatch('checkin/setStatistics', {
      date: new Date({ inputDate: date }),
      eventId: route.params.eventId,
    })
  }

  onMounted(() => {
    inputDate.value = new Date()
    store.dispatch('checkin/setStatistics', {
      date: new Date({ inputDate: inputDate.value }),
      eventId: route.params.eventId,
    })
  })
</script>
<template>
  <v-container class="statistics-container">
    <!-- Header Section -->
    <PageTitle
      :subtitle="event?.name"
      title="Statistics"
    />

    <v-row
      align="stretch"
      justify="center"
    >
      <v-col
        class="flex-grow-1"
        cols="12"
        md="6"
        sm="8"
      >
        <v-card
          class="h-100"
          :rounded="rounded"
        >
          <v-card-title>Total Counts</v-card-title>
          <v-divider />
          <v-card-text v-if="statistics">
            <div class="text-body-1">
              Total Registration:
              <v-chip
                color="primary"
                rounded="sm"
                size="x-large"
              >
                {{ statistics.totalRegistrationCount || 0 }}
              </v-chip>
            </div>
            <div class="text-body-1 pt-2">
              Total Checkin:
              <v-chip
                color="primary"
                rounded="sm"
                size="x-large"
              >
                {{ statistics.totalCheckinCount || 0 }}
              </v-chip>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col
        class="flex-grow-1"
        cols="12"
        md="6"
        sm="8"
      >
        <v-card
          class="h-100"
          :rounded="rounded"
        >
          <v-card-title>Historical Counts</v-card-title>
          <v-divider />
          <v-card-subtitle>
            <v-date-input
              v-model="inputDate"
              class="mt-2 mt-md-4"
              color="primary"
              label="Input Date"
              max-width="368"
              :rules="[(v) => !!v || 'Date is required!']"
              @update:model-value="handleChangeDateStat"
            />
          </v-card-subtitle>
          <v-card-text v-if="statistics">
            <div class="text-body-1">
              Registration:
              <v-chip
                color="primary"
                rounded="sm"
                size="x-large"
              >
                {{ statistics.historicalRegistrationCount || 0 }}
              </v-chip>
            </div>
            <div class="text-body-1 pt-2">
              Checkin:
              <v-chip
                color="primary"
                rounded="sm"
                size="x-large"
              >
                {{ statistics.historicalCheckinCount || 0 }}
              </v-chip>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
