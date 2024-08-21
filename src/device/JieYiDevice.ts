import { MqttClient } from 'mqtt'
import Device from './Device'
import { v4 as uuidv4 } from 'uuid'
import { Notify } from 'src/constant'
import { DBPerson } from 'src/app.service'

const BulkGet = 'QueryPerson'
const BulkSet = 'AddPersons'

class JieYiDevice extends Device {
  bulkSetPerPage = 10
  bulkSetCurrentPage = 1
  needIssuePersonData = []

  get subscribeTopic() {
    return `kirinemqx/jaemont/${this.machineID}/Ack`
  }

  get publishTopic() {
    return `kirinemqx/jaemont/${this.machineID}`
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
      if (result.operator === BulkGet + '-Ack') {
        this.handleBulkGet(result)
      } else if (result.operator === BulkSet + '-Ack') {
        this.handleBulkSet()
      }
    }
  }

  handleBulkGet(result: any) {
    const ids = (result.info.customId as string).split(',')
    ids.pop()
    this.issuedIds.push(...ids.map((i) => +i))
    this.getIssuedIdsFinished = true
    this.notify(Notify.GET_ISSUED_IDS_FINISHED)
    console.log(`${this.deviceName}已获取当前设备中的人员信息：${ids.length}条`)
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
        messageId: uuidv4(),
        operator: BulkGet,
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
        messageId: uuidv4(),
        operator: BulkSet,
        DataBegin: 'BeginFlag',
        PersonNum: items.length,
        info: items.map((item) => ({
          customId: item.id,
          name: item.name,
          picURI: item.photo,
        })),
        DataEnd: 'EndFlag',
      }),
    )
  }
}

export default JieYiDevice
