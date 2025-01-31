const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

// Middleware to protect routes
// const protect = async (req, res, next) => {
//     try {
//         let token;
//         if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
//             token = req.headers.authorization.split(' ')[1];
//             const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
//             req.user = { id: decoded.id };
//             next();
//         } else {
//             res.status(401).json({ message: 'Not authorized' });
//         }
//     } catch (error) {
//         res.status(401).json({ message: 'Not authorized', error: error.message });
//     }
// };

// Create new expense
router.post('/', protect, async (req, res) => {
    try {
        const { description, amount, splitBetween } = req.body;
        console.log('Creating expense:', { description, amount, splitBetween, user: req.user });

        // Validate the input
        if (!description || !amount || !splitBetween || !Array.isArray(splitBetween)) {
            return res.status(400).json({ message: 'Please provide all required fields' });
        }

        // Validate that all usernames are provided and shares are valid
        const validSplitBetween = splitBetween.filter(split => 
            split.username && 
            typeof split.share === 'number' && 
            split.share > 0
        );

        if (validSplitBetween.length === 0) {
            return res.status(400).json({ message: 'Please provide at least one valid user to split with' });
        }

        // Calculate total shares to verify they match the amount
        const totalShares = validSplitBetween.reduce((sum, split) => sum + split.share, 0);
        if (Math.abs(totalShares - amount) > 0.01) { // Using small epsilon for floating point comparison
            return res.status(400).json({ message: 'Total shares must equal the expense amount' });
        }

        const expense = await Expense.create({
            description,
            amount,
            paidBy: req.user._id,
            splitBetween: validSplitBetween
        });

        // Format the response
        const formattedExpense = {
            _id: expense._id,
            description: expense.description,
            amount: expense.amount,
            paidBy: req.user.name,
            splitBetween: expense.splitBetween,
            createdAt: expense.createdAt
        };

        res.status(201).json(formattedExpense);
    } catch (error) {
        console.error('Error creating expense:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get all expenses for a user
router.get('/', protect, async (req, res) => {
    try {
        console.log('Fetching expenses for user:', req.user._id);
        const expenses = await Expense.find({
            $or: [
                { paidBy: req.user._id },
                { 'splitBetween.username': req.user.name }
            ]
        });

        // Format the response
        const formattedExpenses = await Promise.all(expenses.map(async (expense) => {
            const paidByUser = await User.findById(expense.paidBy);
            return {
                _id: expense._id,
                description: expense.description,
                amount: expense.amount,
                paidBy: paidByUser ? paidByUser.name : 'Unknown',
                splitBetween: expense.splitBetween,
                createdAt: expense.createdAt
            };
        }));

        res.json(formattedExpenses);
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get expense by ID
router.get('/:id', protect, async (req, res) => {
    try {
        console.log('Fetching expense by ID:', req.params.id);
        const expense = await Expense.findById(req.params.id);

        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }

        const paidByUser = await User.findById(expense.paidBy);
        const formattedExpense = {
            _id: expense._id,
            description: expense.description,
            amount: expense.amount,
            paidBy: paidByUser ? paidByUser.name : 'Unknown',
            splitBetween: expense.splitBetween,
            createdAt: expense.createdAt
        };

        res.json(formattedExpense);
    } catch (error) {
        console.error('Error fetching expense by ID:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
