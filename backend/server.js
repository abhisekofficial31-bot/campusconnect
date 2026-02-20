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
    cors: { origin: "*" }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

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

/* ================= EMAIL ================= */

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
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

/* 🔥 NEW: Registration Schema */

const registrationSchema = new mongoose.Schema({
    eventId: String,
    eventTitle: String,
    userEmail: String,
    userName: String
});
const Registration = mongoose.model("Registration", registrationSchema);

/* ================= SOCKET ================= */

io.on("connection", (socket) => {
    console.log("User Connected:", socket.id);
});

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

        io.emit("newNotification", `📢 New Event Added: ${title}`);

        // 🔥 Send email to ALL users when new event added
        const users = await User.find();
        const emails = users.map(user => user.email);

        if (emails.length > 0) {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: emails,
                subject: `New Event: ${title}`,
                text: `A new event "${title}" has been added.

Date: ${date}
Time: ${time}
Location: ${location}`
            });
        }

        res.json({ message: "Event added & email sent" });

    } catch (err) {
        console.log(err);
        res.json({ message: "Error adding event" });
    }
});

/* ================= UPDATE EVENT ================= */

app.put("/update-event/:id", async (req, res) => {
    try {

        const { title, date, time, location } = req.body;
        const eventId = req.params.id;

        await Event.findByIdAndUpdate(eventId, {
            title, date, time, location
        });

        /* Send update email ONLY to registered users */
        const registeredUsers = await Registration.find({ eventId });
        const emails = registeredUsers.map(r => r.userEmail);

        if (emails.length > 0) {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: emails,
                subject: `Event Updated: ${title}`,
                text: `The event "${title}" has been updated.

New Details:
Date: ${date}
Time: ${time}
Location: ${location}`
            });
        }

        res.json({ message: "Event updated & emails sent" });

    } catch (err) {
        res.json({ message: "Update error" });
    }
});

/* ================= GET EVENTS ================= */

app.get("/events", async (req, res) => {
    const events = await Event.find();
    res.json(events);
});

/* ================= DELETE EVENT ================= */

app.delete("/delete-event/:id", async (req, res) => {
    await Event.findByIdAndDelete(req.params.id);
    await Registration.deleteMany({ eventId: req.params.id });
    res.json({ message: "Event deleted" });
});

/* ================= REGISTER EVENT ================= */

app.post("/register-event", async (req, res) => {
    try {

        const { eventId, eventTitle, userEmail, userName } = req.body;

        const alreadyRegistered = await Registration.findOne({
            eventId,
            userEmail
        });

        if (alreadyRegistered) {
            return res.json({ message: "Already registered" });
        }

        const newRegistration = new Registration({
            eventId,
            eventTitle,
            userEmail,
            userName
        });

        await newRegistration.save();

        /* Send confirmation email */
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: userEmail,
            subject: `Registration Confirmed: ${eventTitle}`,
            text: `Hi ${userName},

You have successfully registered for "${eventTitle}".

You will receive updates if anything changes.

- CampusConnect Team`
        });

        res.json({ message: "Registration successful & email sent" });

    } catch (err) {
        res.json({ message: "Registration error" });
    }
});

/* ================= SIGNUP ================= */

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

    } catch {
        res.json({ message: "Signup error" });
    }
});

/* ================= SIGNIN ================= */

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

    } catch {
        res.json({ message: "Login error" });
    }
});

/* ================= START SERVER ================= */

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
