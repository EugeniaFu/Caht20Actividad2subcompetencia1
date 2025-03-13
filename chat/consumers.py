from channels.generic.websocket import AsyncWebsocketConsumer
import json

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = 'Test-Room'

        # Unir al grupo
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        # Aceptar la conexión WebSocket
        await self.accept()
        print(f"Conexión establecida: {self.channel_name}")

    async def disconnect(self, close_code):
        # Desunir del grupo
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        print(f"Desconectado: {self.channel_name}")

    async def receive(self, text_data):
        # Procesar el mensaje recibido
        receive_dict = json.loads(text_data)
        message = receive_dict.get('message', {})
        action = receive_dict.get('action', '')

        receiver_channel_name = message.get('receiver_channel_name')

        if action in ('new-offer', 'new-answer') and receiver_channel_name:
            # Enviar solo a un usuario específico
            send_data = receive_dict.copy()
            send_data['message']['receiver_channel_name'] = self.channel_name

            await self.channel_layer.send(
                receiver_channel_name,
                {
                    'type': 'send.sdp',
                    'message': send_data
                }
            )
            return

        # Enviar el mensaje al grupo
        send_data = receive_dict.copy()
        send_data['message']['receiver_channel_name'] = self.channel_name

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'send.sdp',
                'message': send_data
            }
        )

    async def send_sdp(self, event):
        # Extraer el mensaje del evento correctamente
        receive_dict = event['message']

        # Enviar el mensaje al WebSocket
        await self.send(text_data=json.dumps(receive_dict))
