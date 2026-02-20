const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const { Resend } = require("resend");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

/* ================= RESEND ================= */

if (!process.env.RESEND_API_KEY) {
    console.log("❌ RESEND_API_KEY is NOT loaded");
} else {
    console.log("✅ RESEND_API_KEY loaded");
}

const resend = new Resend(process.env.RESEND_API_KEY);

/* ================= MONGODB ================= */

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Atlas Connected"))
    .catch(err => console.log("Mongo Error:", err));

/* ================= STATIC FILES ================= */

app.use(express.static(path.join(__dirname, "../")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ================= MULTER ================= */

const storage = multer.diskStorage({
    destination: path.join(__dirname, "uploads"),
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

/* ================= SCHEMAS ================= */

const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String
});
const User = mongoose.model("User", userSchema);

const eventSchema = new mongoose.Schema({
    title: String,
    date: String,
    time: String,
    location: String,
    image: String
});
const Event = mongoose.model("Event", eventSchema);

const registrationSchema = new mongoose.Schema({
    eventId: String,
    eventTitle: String,
    userEmail: String,
    userName: String
});
const Registration = mongoose.model("Registration", registrationSchema);

/* ================= ROUTES ================= */

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../index.html"));
});

/* ================= ADD EVENT ================= */

app.post("/add-event", upload.single("image"), async (req, res) => {
    try {
        const { title, date, time, location } = req.body;

        const newEvent = new Event({
            title,
            date,
            time,
            location,
            image: req.file ? "/uploads/" + req.file.filename : ""
        });

        await newEvent.save();

        const users = await User.find();
        const emails = users.map(user => user.email);

        console.log("📧 Emails to send:", emails);

        if (emails.length > 0) {

            const response = await resend.emails.send({
                from: "onboarding@resend.dev",
                to: emails,
                subject: `New Event: ${title}`,
                text: `Test Email from CampusConnect`
            });

            console.log("🔥 RESEND RESPONSE:", response);
        }

        res.json({ message: "Event added" });

    } catch (err) {
        console.log("❌ ADD EVENT ERROR:", err);
        res.json({ message: "Error adding event" });
    }
});

/* ================= REGISTER EVENT ================= */

app.post("/register-event", async (req, res) => {
    try {
        const { eventId, eventTitle, userEmail, userName } = req.body;

        const newRegistration = new Registration({
            eventId,
            eventTitle,
            userEmail,
            userName
        });

        await newRegistration.save();

        const response = await resend.emails.send({
            from: "onboarding@resend.dev",
            to: userEmail,
            subject: `Registration Confirmed`,
            text: `Test Registration Email`
        });

        console.log("🔥 REGISTRATION EMAIL RESPONSE:", response);

        res.json({ message: "Registered" });

    } catch (err) {
        console.log("❌ REGISTER ERROR:", err);
        res.json({ message: "Registration error" });
    }
});

/* ================= GET EVENTS ================= */

app.get("/events", async (req, res) => {
    const events = await Event.find();
    res.json(events);
});

/* ================= START SERVER ================= */

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
