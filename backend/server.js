const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const nodemailer = require("nodemailer");

const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" }
});

/* ================= MIDDLEWARE ================= */

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================= MONGODB ================= */

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.log("❌ Mongo Error:", err));

/* ================= CLOUDINARY CONFIG ================= */

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: "campusconnect",
        allowed_formats: ["jpg", "png", "jpeg"]
    }
});

const upload = multer({ storage });

/* ================= EMAIL ================= */

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

transporter.verify()
    .then(() => console.log("✅ Email ready"))
    .catch(err => console.log("❌ Email error:", err));

/* ================= STATIC ================= */

app.use(express.static(path.join(__dirname, "..")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "index.html"));
});

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

/* ================= ROUTES ================= */

/* ===== ADD EVENT ===== */

app.post("/add-event", upload.single("image"), async (req, res) => {
    try {
        const { title, date, time, location } = req.body;

        const newEvent = new Event({
            title,
            date,
            time,
            location,
            image: req.file ? req.file.path : ""
        });

        await newEvent.save();

        io.emit("newNotification", `📢 New Event Added: ${title}`);

        res.json({ message: "Event added successfully" });

    } catch (err) {
        console.log("ADD EVENT ERROR:", err);
        res.status(500).json({ message: "Error adding event" });
    }
});

/* ===== GET EVENTS ===== */

app.get("/events", async (req, res) => {
    try {
        const events = await Event.find().sort({ _id: -1 });
        res.json(events);
    } catch (err) {
        console.log("GET EVENTS ERROR:", err);
        res.status(500).json({ message: "Error fetching events" });
    }
});

/* ===== DELETE EVENT ===== */

app.delete("/delete-event/:id", async (req, res) => {
    try {
        await Event.findByIdAndDelete(req.params.id);
        res.json({ message: "Event deleted successfully" });
    } catch (err) {
        console.log("DELETE ERROR:", err);
        res.status(500).json({ message: "Delete error" });
    }
});

/* ===== SEND NOTIFICATION ===== */

app.post("/send-notification/:id", async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        const users = await User.find();

        if (!event) return res.json({ message: "Event not found" });
        if (users.length === 0) return res.json({ message: "No users found" });

        await Promise.all(
            users.map(user =>
                transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: user.email,
                    subject: `📢 New Event: ${event.title}`,
                    html: `
                        <h2>${event.title}</h2>
                        <p><strong>Date:</strong> ${event.date}</p>
                        <p><strong>Time:</strong> ${event.time}</p>
                        <p><strong>Location:</strong> ${event.location}</p>
                        ${event.image ? `<img src="${event.image}" width="300"/>` : ""}
                    `
                })
            )
        );

        res.json({ message: "Emails sent successfully" });

    } catch (err) {
        console.log("EMAIL ERROR:", err);
        res.status(500).json({ message: "Email sending failed" });
    }
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log("🚀 Server running on port", PORT);
});