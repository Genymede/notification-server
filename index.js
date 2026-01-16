const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

// ดึงค่าจาก Environment Variables ของ Vercel
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  // การจัดการ Private Key: ต้องแก้เรื่อง \n เพื่อให้ Vercel อ่านบรรทัดใหม่ได้ถูกต้อง
  privateKey: process.env.FIREBASE_PRIVATE_KEY 
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
    : undefined,
};

// ตรวจสอบว่าค่ามาครบไหม ถ้าไม่ครบให้แจ้งเตือน
if (!serviceAccount.projectId || !serviceAccount.privateKey || !serviceAccount.clientEmail) {
  console.error('Missing Firebase Credentials! Check Vercel Environment Variables.');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://medapp-f816a-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const app = express();
app.use(cors({ origin: '*' })); // ควรเปลี่ยน '*' เป็นโดเมนเว็บจริงของคุณเมื่อขึ้น Production
app.use(express.json());

// Route สำหรับเช็คสถานะ Server
app.get('/', (req, res) => {
  res.send('Notification Server is running on Vercel!');
});

app.post('/send-call-notification', async (req, res) => {
  const { doctorId, patientName = 'ผู้ป่วย' } = req.body;

  if (!doctorId) return res.status(400).json({ error: 'ต้องระบุ doctorId' });

  try {
    const db = admin.database();
    const doctorSnap = await db.ref(`doctors/${doctorId}`).once('value');
    const doctor = doctorSnap.val();

    // แก้ตรงนี้: เช็ค expoPushToken แทน fcmToken
    if (!doctor?.online || !doctor?.expoPushToken) {
      return res.status(400).json({ error: 'แพทย์ไม่ออนไลน์หรือไม่มี token' });
    }

    const expoToken = doctor.expoPushToken;

    // ส่งด้วย Expo Push API (แทน FCM)
    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: expoToken,
        sound: 'default',
        title: 'มีคำขอปรึกษาใหม่!',
        body: `${patientName} ต้องการปรึกษาคุณด่วน`,
        data: { type: 'incoming_call', doctorId },
      }),
    });

    const expoResult = await expoResponse.json();

    if (expoResult.errors || expoResult.data?.status !== 'ok') {
      throw new Error(expoResult.errors?.[0]?.message || 'ส่งไม่สำเร็จ');
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'ส่งแจ้งเตือนล้มเหลว', details: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));