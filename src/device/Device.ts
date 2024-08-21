import { MqttClient } from 'mqtt'
import { DBPerson } from 'src/app.service'
import { Notify } from 'src/constant'

abstract class Device {
  deviceName: string
  regionIds?: number[]
  issuedIds: number[] = []
  needIssueList: DBPerson[] = []
  isConnected = false
  getIssuedIdsFinished = false
  issueFinished = false

  constructor(
    public client: MqttClient,
    public notify: (name: Notify) => void,
  ) {}

  abstract connected(): void
  abstract received(topic: string, payload: string): void
  abstract getIssuedIds(): void
  abstract distribute(data: DBPerson[]): void
  abstract delete(ids: number[]): void
}

export default Device
