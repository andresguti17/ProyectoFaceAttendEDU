import { batched } from "../batching";

describe("batched", () => {
    it("keeps result order across batches", async () => {
        const out = await batched([1, 2, 3, 4, 5], async (n) => n * 10, 2);
        expect(out).toEqual([10, 20, 30, 40, 50]);
    });

    it("never runs more than `size` tasks at once", async () => {
        let running = 0;
        let peak = 0;
        const work = async () => {
            running += 1;
            peak = Math.max(peak, running);
            await new Promise((resolve) => setTimeout(resolve, 1));
            running -= 1;
        };
        await batched([1, 2, 3, 4, 5, 6, 7], work, 3);
        expect(peak).toBe(3);
    });

    it("passes the item and its index inside the batch, and nothing else", async () => {
        const calls = [];
        await batched(["a", "b", "c"], async (...args) => calls.push(args), 2);
        expect(calls).toEqual([["a", 0], ["b", 1], ["c", 0]]);
    });
});
