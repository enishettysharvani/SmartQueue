
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// Queue database structure
const queueSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true },
    service: { type: String, required: true },
    token: { type: String, required: true, unique: true },
    status: {
        type: String,
        enum: ["Waiting", "Serving", "Completed"],
        default: "Waiting"
    },
    createdAt: { type: Date, default: Date.now }
});

const Queue = mongoose.model("Queue", queueSchema);

// Test route
app.get("/", (req, res) => {
    res.send("SmartQueue backend is running!");
});

// Get all tokens
app.get("/api/queue", async (req, res) => {
    try {
        const queue = await Queue.find().sort({ createdAt: 1 });
        res.json(queue);
    } catch (error) {
        res.status(500).json({ message: "Could not load queue" });
    }
});

// Generate a token
app.post("/api/queue", async (req, res) => {
    try {
        const { name, location, service } = req.body;

        if (
            typeof name !== "string" || !name.trim() ||
            typeof location !== "string" || !location.trim() ||
            typeof service !== "string" || !service.trim()
        ) {
            return res.status(400).json({
                message: "Please provide name, location and service."
            });
        }

        const count = await Queue.countDocuments();
        const token = "A-" + String(count + 1).padStart(3, "0");

        const person = await Queue.create({
            name: name.trim(),
            location,
            service,
            token
        });

        const peopleAhead = await Queue.countDocuments({
            status: "Waiting",
            createdAt: { $lt: person.createdAt }
        });

        res.status(201).json({
            ...person.toObject(),
            peopleAhead,
            estimatedWait: peopleAhead * 3
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not create token" });
    }
});

// Admin calls the next customer
app.post("/api/queue/next", async (req, res) => {
    try {
        const current = await Queue.findOne({ status: "Serving" });

        if (current) {
            current.status = "Completed";
            await current.save();
        }

        const next = await Queue.findOne({ status: "Waiting" })
            .sort({ createdAt: 1 });

        if (!next) {
            return res.json({ message: "No waiting customers" });
        }

        next.status = "Serving";
        await next.save();

        res.json({
            message: "Now serving " + next.token,
            currentToken: next.token
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not call next customer" });
    }
});

// Connect database and start server
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connected successfully");

        app.listen(process.env.PORT || 3000, () => {
            console.log("SmartQueue backend running at http://localhost:3000");
        });
    })
    .catch(error => {
        console.error("MongoDB connection failed:", error.message);
    });