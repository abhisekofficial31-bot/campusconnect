const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");

const app = express();
const server = http.createServer(app);

/* ================= SOCKET.IO ================= */

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

/* ================= MIDDLEWARE ================= */

app.use(cors({
    origin: "*",
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================= MONGODB ================= */

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.log("❌ Mongo Error:", err));

/* ================= STATIC FILES ================= */

// Serve uploaded images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// If you have frontend build folder (React), use this:
// app.use(express.static(path.join(__dirname, "client/build")));

/* ================= MULTER ================= */

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "uploads"));
    },
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

app.get("/", (req, res) => {
    res.send("CampusConnect Backend Running 🚀");
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
            image: req.file ? `/uploads/${req.file.filename}` : ""
        });

        await newEvent.save();

        io.emit("newNotification", `📢 New Event Added: ${title}`);

        res.json({ message: "Event added successfully" });

    } catch (err) {
        console.log("ADD EVENT ERROR:", err);
        res.status(500).json({ message: "Error adding event" });
    }
});

/* ================= GET EVENTS ================= */

app.get("/events", async (req, res) => {
    try {
        const events = await Event.find().sort({ _id: -1 });
        res.json(events);
    } catch (err) {
        console.log("GET EVENTS ERROR:", err);
        res.status(500).json({ message: "Error fetching events" });
    }
});

/* ================= UPDATE EVENT ================= */

app.put("/update-event/:id", async (req, res) => {
    try {
        const { title, date, time, location } = req.body;

        await Event.findByIdAndUpdate(req.params.id, {
            title,
            date,
            time,
            location
        });

        res.json({ message: "Event updated successfully" });

    } catch (err) {
        console.log("UPDATE ERROR:", err);
        res.status(500).json({ message: "Update error" });
    }
});

/* ================= DELETE EVENT ================= */

app.delete("/delete-event/:id", async (req, res) => {
    try {
        await Event.findByIdAndDelete(req.params.id);
        await Registration.deleteMany({ eventId: req.params.id });

        res.json({ message: "Event deleted successfully" });

    } catch (err) {
        console.log("DELETE ERROR:", err);
        res.status(500).json({ message: "Delete error" });
    }
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

        res.json({ message: "Registration successful" });

    } catch (err) {
        console.log("REGISTER ERROR:", err);
        res.status(500).json({ message: "Registration error" });
    }
});

/* ================= AUTH ================= */

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
