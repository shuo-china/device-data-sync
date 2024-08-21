import { Global, Module } from '@nestjs/common'
import { connect } from 'mqtt'
import { MQTT_CLIENT_INSTANCE } from 'src/constant'

@Global()
@Module({
  providers: [
    {
      provide: MQTT_CLIENT_INSTANCE,
      useFactory: () => {
        const client = connect('mqtt://mqtt.kylinsoft.ltd:1883', {
          username: 'kirin',
          password: 'kirin5678',
        })

        return client
      },
    },
  ],
  exports: [MQTT_CLIENT_INSTANCE],
})
export class MqttModule {}
