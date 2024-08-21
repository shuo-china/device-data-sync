import { MqttClient } from 'mqtt'
import Device from './Device'
import { v4 as uuidv4 } from 'uuid'
import { Notify } from 'src/constant'
import { DBPerson } from 'src/app.service'

const BulkGet = 'face.bulkGet'
const BulkSet = 'face.bulkSet'

class SuanZiDevice extends Device {
  bulkGetPerPage = 200
  bulkGetCurrentPage = 1
  bulkSetPerPage = 10
  bulkSetCurrentPage = 1
  needIssuePersonData = []
  messageId = uuidv4()

  get subscribeTopic() {
    return `kirinemqx/mqttrrpc/${this.machineID}/response/${this.messageId}`
  }

  get publishTopic() {
    return `kirinemqx/mqttrrpc/${this.machineID}/request/${this.messageId}`
  }

  constructor(
    client: MqttClient,
    notify: (name: Notify) => void,
    public deviceName: string,
    public machineID: string,
    public regionIds?: number[],
  ) {
    super(client, notify)
  }

  connected() {
    this.client.subscribe(this.subscribeTopic, (err) => {
      if (!err) {
        this.isConnected = true
        this.notify(Notify.IS_CONNECTED)
      }
    })
  }

  received(topic: string, payload: string) {
    const result = JSON.parse(payload)
    if (topic === this.subscribeTopic) {
      if (result.method === BulkGet) {
        this.handleBulkGet(result)
      } else if (result.method === BulkSet) {
        this.handleBulkSet()
      }
    }
  }

  handleBulkGet(result: any) {
    const items = result.data.items || []
    const total = result.data.total
    const lastPage = Math.ceil(total / this.bulkGetPerPage)
    this.issuedIds.push(...items.map((i) => i.trdID))

    if (this.bulkGetCurrentPage < lastPage) {
      this.bulkGetCurrentPage++
      this.getIssuedIds()
    } else {
      this.getIssuedIdsFinished = true
      this.notify(Notify.GET_ISSUED_IDS_FINISHED)
      console.log(
        `${this.deviceName}已获取当前设备中的人员信息：${this.bulkGetPerPage * (this.bulkGetCurrentPage - 1) + items.length}条`,
      )
    }
  }

  handleBulkSet() {
    const lastPage = Math.ceil(this.needIssueList.length / this.bulkSetPerPage)
    if (this.bulkSetCurrentPage < lastPage) {
      this.bulkSetCurrentPage++
      this.distributeByBatch()
    } else {
      console.log(`${this.deviceName}下发完成`)
      this.issueFinished = true
      this.notify(Notify.ISSUE_FINISHED)
    }
  }

  getIssuedIds() {
    this.client.publish(
      this.publishTopic,
      JSON.stringify({
        id: Math.ceil(Math.random() * 10 ** 5),
        method: BulkGet,
        params: {
          limit: this.bulkGetPerPage,
          page: this.bulkGetCurrentPage,
          sortBy: 'id',
          sortOrder: 'asc',
        },
      }),
    )
  }

  distribute(data: DBPerson[]) {
    this.needIssueList = data

    if (this.needIssueList.length) {
      this.distributeByBatch()
    } else {
      console.log(`${this.deviceName}下发完成`)
      this.issueFinished = true
      this.notify(Notify.ISSUE_FINISHED)
    }
  }

  distributeByBatch() {
    const startIndex = (this.bulkSetCurrentPage - 1) * this.bulkSetPerPage
    const items = this.needIssueList.slice(startIndex, startIndex + this.bulkSetPerPage)

    if (startIndex) {
      console.log(`${this.deviceName}已下发完成：${startIndex}条`)
    }

    this.client.publish(
      this.publishTopic,
      JSON.stringify({
        id: Math.ceil(Math.random() * 10 ** 5),
        method: BulkSet,
        params: {
          items: items.map((item) => ({
            id: item.id,
            trdID: item.id,
            name: item.name,
            number: item.id + '',
            image: {
              type: 'URL',
              url: item.photo,
            },
          })),
        },
      }),
    )
  }
}

export default SuanZiDevice
