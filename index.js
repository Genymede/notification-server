import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { GoogleAuth } from 'google-auth-library';
//import fs from 'fs';

const app = express();
app.use(cors());
app.use(express.json());

// โหลด service account
// const serviceAccount = JSON.parse(
//   fs.readFileSync('./service-account.json', 'utf8')
// );

let serviceAccount;
try {
  if (process.env.SERVICE_ACCOUNT_JSON) {
    serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_JSON);
  } else {
    throw new Error('Missing SERVICE_ACCOUNT_JSON environment variable');
  }
} catch (error) {
  console.error('Error parsing Service Account:', error);
  // ให้ Server ทำงานต่อได้ แต่จะส่ง FCM ไม่ได้ (ดีกว่า Crash)
}

const PROJECT_ID = serviceAccount.project_id;

const auth = new GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
});

// health check
app.get('/', (_, res) => {
  res.send('FCM CALL SERVER RUNNING');
});

app.post('/send-call', async (req, res) => {
  const { fcmToken, patientName, roomId, requestId, origin } = req.body;

  if (!fcmToken) {
    return res.status(400).json({ error: 'Missing fcmToken' });
  }

  try {
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    const payload = {
      message: {
        token: fcmToken,
        data: {
          type: 'incoming_call',
          title: '📞 มีสายเรียกเข้า',
          body: `${patientName || 'ผู้ป่วย'} จาก ${origin || 'โรงพยาบาล'} ต้องการปรึกษาคุณ`,
          roomId: roomId || '',
          requestId,
          patientName: patientName || 'ผู้ป่วย',
          origin: origin || 'โรงพยาบาล'
        },
        android: {
          priority: 'HIGH',
          ttl: '60s',
          notification: {
            title: '📞 มีสายเรียกเข้า',
            body: `${patientName || 'ผู้ป่วย'} จาก ${origin || 'โรงพยาบาล'} ต้องการปรึกษาคุณ`,
            sound: 'default',
            channel_id: 'default',
          },
        },
      },
    };

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ FCM ERROR:', result);
      return res.status(500).json(result);
    }

    console.log('✅ FCM SENT:', result);
    res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// app.listen(3000, () => {
//   console.log('🚀 Call notification server running on port 3000');
// });

export default app;
