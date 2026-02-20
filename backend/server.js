const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const nodemailer = require("nodemailer");
const multer = require("multer");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

app.use(express.json());
app.use(cors());

/* ===== MongoDB ===== */

mongoose.connect("mongodb+srv://campususer:campus123@cluster0.okcoynj.mongodb.net/campusconnect?retryWrites=true&w=majority")
.then(() => console.log("MongoDB Atlas Connected"))
.catch(err => console.log("Mongo Error:", err));

/* ===== Static Folder for Images ===== */
app.use("/uploads", express.static("uploads"));

/* ===== Multer Setup ===== */

const storage = multer.diskStorage({
    destination: "./uploads/",
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

/* ===== Nodemailer ===== */

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "abhisekofficial31@gmail.com",
        pass: "xraqnckgypawfdrs"  // 🔴 Replace with your Gmail App Password
    }
});

/* ===== User Schema ===== */

const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String
});

const User = mongoose.model("User", userSchema);

/* ===== Event Schema ===== */

const eventSchema = new mongoose.Schema({
    title: String,
    date: String,
    time: String,
    location: String,
    image: String
});

const Event = mongoose.model("Event", eventSchema);

/* ===== Socket Connection ===== */

io.on("connection", (socket) => {
    console.log("User Connected:", socket.id);
});

/* ===== Add Event API (Upload + Email + Realtime) ===== */

app.post("/add-event", upload.single("image"), async (req, res) => {
    try {

        const { title, date, time, location } = req.body;

        if (!title) {
            return res.json({ message: "Title is required" });
        }

        const newEvent = new Event({
            title,
            date,
            time,
            location,
            image: req.file ? "/uploads/" + req.file.filename : ""
        });

        await newEvent.save();

        // 🔥 Realtime Notification
        io.emit("newNotification", `📢 New Event Added: ${title}`);

        // 📧 Send Email to All Users
        const users = await User.find();

        const emails = users.map(user => user.email);

        if (emails.length > 0) {
            await transporter.sendMail({
                from: "24057004@kiit.ac.in",
                to: emails,
                subject: `New Event: ${title}`,
                text: `A new event "${title}" has been added on CampusConnect.\n\nDate: ${date}\nTime: ${time}\nLocation: ${location}`
            });
        }

        res.json({ message: "Event added & notifications sent" });

    } catch (err) {
        console.log(err);
        res.json({ message: "Error adding event" });
    }
});

/* ===== Get All Events ===== */

app.get("/events", async (req, res) => {
    const events = await Event.find();
    res.json(events);
});

/* ===== Delete Event ===== */

app.delete("/delete-event/:id", async (req, res) => {
    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: "Event deleted" });
});

/* ===== Signup API ===== */

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
        res.json({ message: "Error during signup" });
    }
});

/* ===== Signin API ===== */

app.post("/signin", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email, password });

        if (!user) {
            return res.json({ message: "Invalid credentials" });
        }

        res.json({ message: "Login successful", user });

    } catch (err) {
        res.json({ message: "Error during login" });
    }
});

/* ===== Start Server ===== */

server.listen(5000, () => {
    console.log("Server running on port 5000");
});
 

