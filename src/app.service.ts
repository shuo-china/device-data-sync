import { Inject, Injectable } from '@nestjs/common'
import { MQTT_CLIENT_INSTANCE, Notify } from './constant'
import { MqttClient } from 'mqtt'
import Device from './device/Device'
import { suanZiDeviceList, jieYiDeviceList, activityNo } from './device/config'
import SuanZiDevice from './device/SuanZiDevice'
import JieYiDevice from './device/JieYiDevice'
import axios from 'axios'
import * as _ from 'lodash'

export type DBPerson = {
  id: number
  name: string
  photo: string
  regionIds: number[]
}

@Injectable()
export class AppService {
  deviceList: Device[] = []
  dbPersons: DBPerson[] = []

  constructor(@Inject(MQTT_CLIENT_INSTANCE) private readonly client: MqttClient) {
    suanZiDeviceList.forEach((d) => {
      const suanZiInstance = new SuanZiDevice(client, this.notify.bind(this), d.deviceName, d.machineID, d?.regionIds)
      this.deviceList.push(suanZiInstance)
    })

    jieYiDeviceList.forEach((d) => {
      const jieYiInstance = new JieYiDevice(client, this.notify.bind(this), d.deviceName, d.machineID, d?.regionIds)
      this.deviceList.push(jieYiInstance)
    })

    client.on('connect', () => {
      this.deviceList.forEach((d) => d.connected())
    })

    client.on('message', (topic, buffer) => {
      const payload = buffer.toString()
      this.deviceList.forEach((d) => d.received(topic, payload))
    })
  }

  async notify(name: Notify) {
    if (name === Notify.IS_CONNECTED) {
      const allConnected = this.deviceList.every((d) => d.isConnected)
      if (allConnected) {
        this.getIssuedIds()
      }
    } else if (name === Notify.GET_ISSUED_IDS_FINISHED) {
      const allGetIssuedIdsFinished = this.deviceList.every((d) => d.getIssuedIdsFinished)
      if (allGetIssuedIdsFinished) {
        await this.getDbIds()
        this.compare()
      }
    } else if (name === Notify.ISSUE_FINISHED) {
      const allIssueFinished = this.deviceList.every((d) => d.issueFinished)
      if (allIssueFinished) {
        console.log('全部设备下发完成')
      }
    }
  }

  getIssuedIds() {
    this.deviceList.forEach((d) => {
      d.getIssuedIdsFinished = false
      d.getIssuedIds()
    })
  }

  getDbIds() {
    return axios(`https://api-xzez.kylinsoft.ltd/admin/employee_test?activity_no=${activityNo}`).then((res) => {
      console.log(`数据库人员信息获取成功：${res.data.length}条`)
      this.dbPersons = res.data.map((d) => ({
        id: d.id,
        name: d.name,
        photo: d.face_photo_path,
        regionIds:
          d.activity_region_ids === '0' || d.activity_region_ids === ''
            ? []
            : d.activity_region_ids.split(',').map((i) => +i),
      }))
    })
  }

  compare() {
    this.deviceList.forEach((d) => {
      const needIssueIds = this.dbPersons
        .filter((p) => {
          if (d.regionIds) {
            if (d.regionIds.some((i) => p.regionIds.includes(i))) {
              return true
            } else {
              return false
            }
          } else {
            return true
          }
        })
        .map((p) => p.id)

      const needDelIds = _.difference(d.issuedIds, needIssueIds)
      console.log(`${d.deviceName}需要删除：${needDelIds.length}条`)
      if (needDelIds.length) {
        d.delete(needDelIds)
      }

      const noIssueIds = _.difference(needIssueIds, d.issuedIds)
      const noIssueData = this.dbPersons.filter((d) => noIssueIds.includes(d.id))
      console.log(`${d.deviceName}需要下发：${noIssueData.length}条`)
      d.distribute(noIssueData)
    })
  }
}
