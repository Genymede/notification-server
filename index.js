const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

const serviceAccount = require('./serviceAccountKey.json'); // ดาวน์โหลดจาก Firebase → Project Settings → Service Accounts

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://medapp-f816a-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const app = express();
app.use(cors({ origin: '*' })); // เปลี่ยนเป็น domain เว็บคุณ
app.use(express.json());

app.post('/send-call-notification', async (req, res) => {
  const { doctorId, patientName = 'ผู้ป่วย' } = req.body;

  if (!doctorId) return res.status(400).json({ error: 'ต้องระบุ doctorId' });

  try {
    // ดึง FCM token จาก Firebase Realtime Database
    const db = admin.database();
    const doctorSnap = await db.ref(`doctors/${doctorId}`).once('value');
    const doctor = doctorSnap.val();

    if (!doctor?.online || !doctor?.fcmToken) {
      return res.status(400).json({ error: 'แพทย์ไม่ออนไลน์หรือไม่มี token' });
    }

    const message = {
      notification: {
        title: 'มีคำขอปรึกษาใหม่!',
        body: `${patientName} ต้องการปรึกษาคุณด่วน`,
      },
      data: {
        type: 'incoming_call',
        doctorId,
      },
      token: doctor.fcmToken,
    };

    await admin.messaging().send(message);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ส่งแจ้งเตือนล้มเหลว' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));