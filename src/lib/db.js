import mongoose from "mongoose";
const cached = global.mongooseConnection ?? {
    connection: null,
    promise: null
};
if (!global.mongooseConnection) {
    global.mongooseConnection = cached;
}
export async function connectToDatabase() {
    if (cached.connection)
        return cached.connection;
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error("MONGODB_URI is not configured.");
    }
    cached.promise ??= mongoose.connect(uri, {
        bufferCommands: false,
        dbName: process.env.MONGODB_DB,
        maxPoolSize: 20,
        serverSelectionTimeoutMS: 5000
    });
    cached.connection = await cached.promise;
    return cached.connection;
}
