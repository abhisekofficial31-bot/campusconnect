require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const multer = require("multer");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");

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

/* ================= MULTER ================= */

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, "uploads"));
    },
    filename: function (req, file, cb) {
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

/* ================= STATIC ================= */

app.use(express.static(path.join(__dirname, "..")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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
    instruction: String,
    image: String,
    externalLink: String  // NEW
});
const Event = mongoose.model("Event", eventSchema);

const registrationSchema = new mongoose.Schema({
    eventId: String,
    name: String,
    email: String
});
const Registration = mongoose.model("Registration", registrationSchema);

/* ================= ROUTES ================= */

/* ===== ADD EVENT ===== */

app.post("/add-event", upload.single("image"), async (req, res) => {
    try {
        const { title, date, time, location, instruction, externalLink } = req.body;

        const newEvent = new Event({
            title,
            date,
            time,
            location,
            instruction: instruction || "",
            externalLink: externalLink || "",
            image: req.file ? "/uploads/" + req.file.filename : ""
        });

        await newEvent.save();
        res.json({ message: "Event added successfully" });

    } catch (err) {
        console.error("ADD EVENT ERROR:", err);
        res.status(500).json({ message: err.message });
    }
});

/* ===== GET EVENTS ===== */

app.get("/events", async (req, res) => {
    const events = await Event.find().sort({ _id: -1 });
    res.json(events);
});

/* ===== REGISTER FOR EVENT ===== */

app.post("/register/:eventId", async (req, res) => {
    try {
        const { name, email } = req.body;

        const registration = new Registration({
            eventId: req.params.eventId,
            name,
            email
        });

        await registration.save();

        res.json({ message: "Registered successfully" });

    } catch (err) {
        res.status(500).json({ message: "Registration error" });
    }
});

/* ===== DOWNLOAD PDF ===== */

app.get("/download-registrations/:eventId", async (req, res) => {
    try {
        const event = await Event.findById(req.params.eventId);
        const registrations = await Registration.find({ eventId: req.params.eventId });

        const doc = new PDFDocument();

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=${event.title}-registrations.pdf`);

        doc.pipe(res);

        doc.fontSize(20).text(event.title, { align: "center" });
        doc.moveDown();
        doc.fontSize(14).text(`Date: ${event.date}`);
        doc.text(`Location: ${event.location}`);
        doc.moveDown();
        doc.text(`Total Students Registered: ${registrations.length}`);
        doc.moveDown();

        registrations.forEach((reg, index) => {
            doc.text(`${index + 1}. ${reg.name} - ${reg.email}`);
        });

        doc.end();

    } catch (err) {
        console.log("PDF ERROR:", err);
        res.status(500).json({ message: "PDF generation error" });
    }
});

/* ===== DELETE EVENT ===== */

app.delete("/delete-event/:id", async (req, res) => {
    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: "Event deleted successfully" });
});

/* ===== SEND NOTIFICATION ===== */

app.post("/send-notification/:id", async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        const users = await User.find();

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
                        ${event.instruction ? `<p><strong>Instructions:</strong> ${event.instruction}</p>` : ""}
                        ${event.image ? `<br/><img src="cid:eventImage" width="400"/>` : ""}
                    `,
                    attachments: event.image ? [
                        {
                            filename: "event.jpg",
                            path: path.join(__dirname, event.image),
                            cid: "eventImage"
                        }
                    ] : []
                })
            )
        );

        res.json({ message: "Emails sent successfully" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log("🚀 Server running on port", PORT);
});