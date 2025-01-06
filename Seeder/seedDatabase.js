// Function to seed database on migration
const seedDatabase = async () => {
    try {
        // Example categories
        const categories = [
            { name: 'Electronics', attributes: [{ name: 'Brand', values: ['Samsung', 'Apple'] }] },
            { name: 'Clothing', attributes: [{ name: 'Size', values: ['S', 'M', 'L'] }] },
        ];

        for (const categoryData of categories) {
            await Category.findOneAndUpdate(
                { name: categoryData.name },
                categoryData,
                { upsert: true, new: true }
            );
        }

        // Example sellers
        const sellers = [
            { name: 'John Doe', email: 'john@example.com', phone: '1234567890', address: '123 Main St', gstNumber: 'GST123' },
            { name: 'Jane Smith', email: 'jane@example.com', phone: '0987654321', address: '456 Side St', gstNumber: 'GST456' },
        ];

        for (const sellerData of sellers) {
            await Seller.findOneAndUpdate(
                { email: sellerData.email },
                sellerData,
                { upsert: true, new: true }
            );
        }

        console.log('Database seeding completed.');
    } catch (err) {
        console.error('Error seeding database:', err);
    }
};


module.exports =  seedDatabase ;
