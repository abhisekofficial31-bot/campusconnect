const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const nodemailer = require("nodemailer");

const app = express();
const server = http.createServer(app);

/* ================= SOCKET.IO ================= */

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

/* ================= EMAIL SETUP ================= */

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Verify transporter on startup
transporter.verify((error, success) => {
    if (error) {
        console.log("❌ Email config error:", error);
    } else {
        console.log("✅ Email server ready");
    }
});

/* ================= STATIC FILES ================= */

// Serve frontend files (parent folder)
app.use(express.static(path.join(__dirname, "..")));

// Serve uploaded images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ================= ROOT ROUTE ================= */

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "index.html"));
});

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

/* ================= SOCKET CONNECTION ================= */

io.on("connection", (socket) => {
    console.log("User Connected:", socket.id);
});

/* ================= ROUTES ================= */

// 🔥 Add Event + Send Email to All Users
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
        console.log("✅ Event saved");

        // Fetch all users
        const users = await User.find();
        console.log("👥 Users found:", users.length);

        if (users.length > 0) {
            const emailPromises = users.map(user => {
                console.log("📨 Sending to:", user.email);

                return transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: user.email,
                    subject: `📢 New Event: ${title}`,
                    html: `
                        <h2>New Event Added 🎉</h2>
                        <p><strong>${title}</strong></p>
                        <p>Date: ${date}</p>
                        <p>Time: ${time}</p>
                        <p>Location: ${location}</p>
                    `
                });
            });

            await Promise.all(emailPromises);
            console.log("✅ All emails sent");
        }

        io.emit("newNotification", `📢 New Event Added: ${title}`);

        res.json({ message: "Event added & emails sent successfully" });

    } catch (err) {
        console.log("❌ ADD EVENT ERROR:", err);
        res.status(500).json({ message: "Error adding event" });
    }
});

// Get Events
app.get("/events", async (req, res) => {
    try {
        const events = await Event.find().sort({ _id: -1 });
        res.json(events);
    } catch (err) {
        console.log("GET EVENTS ERROR:", err);
        res.status(500).json({ message: "Error fetching events" });
    }
});

// Signup
app.post("/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.json({ message: "User already exists" });
        }

        const newUser = new User({ name, email, password });
        await newUser.save();

        res.json({ message: "Signup successful" });

    } catch (err) {
        console.log("SIGNUP ERROR:", err);
        res.status(500).json({ message: "Signup error" });
    }
});

// Signin
app.post("/signin", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email, password });

        if (!user) {
            return res.json({ message: "Invalid credentials" });
        }

        const isAdmin = email === process.env.ADMIN_EMAIL;

        res.json({
            message: "Login successful",
            user,
            isAdmin
        });

    } catch (err) {
        console.log("LOGIN ERROR:", err);
        res.status(500).json({ message: "Login error" });
    }
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log("🚀 Server running on port", PORT);
});