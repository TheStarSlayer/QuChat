import mongoose from "mongoose";
const { Schema, model } = mongoose;

const userSchema = new Schema({
    username: String,
    password: String,
    refreshToken: String
}, {
    timestamps: true
});

const onlineUsersSchema = new Schema({
    username: String,
    isBusy: Boolean,
    loggedAt: Number
});

const User = model('User', userSchema);
const OnlineUsers = model('OnlineUsers', onlineUsersSchema);
export { User, OnlineUsers };