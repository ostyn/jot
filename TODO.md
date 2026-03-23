// Sheet.open({
// type: MapSheet,
// data: { lat: this.station.lat, lon: this.station.long },
// onClose: async (data: any) => {
// console.log('Map sheet closed with data:', data);
// //photon.komoot.io/reverse?lon=10&lat=52
// const placeInfo = await fetch(
// `https://photon.komoot.io/api/?lat=${data.lat}&lon=${data.lon}&q=${data.name}`
// );
// const locationInfo = await fetch(
// `https://photon.komoot.io/reverse?lat=${data.lat}&lon=${data.lon}`
// );
// console.log(await placeInfo.json());
// console.log(await locationInfo.json());
// },
// });

                     // Each activity detail can have multiple locations associated with it, stored as an array of location IDs. Each location is stored in a separate Dexie table, with lat/lon, place name, and other relevant info. When displaying activity details, we can query the locations table for the associated locations and display them on a map or in a list.
                    // Details can be created while in the entry edit view. But right now details are edited from a modal. I want to avoid nesting modals, so what are my options? I could:
                    // 1. Close the entry edit modal, open the detail edit modal, then reopen the entry edit modal when done. This is a bit jarring UX-wise.
                    // 2. Use a non-modal bottom sheet for editing details, so it can slide up over the entry edit modal. This could work well on mobile.
                    // 3. Implement an inline detail editor within the entry edit modal itself, expanding/collapsing sections as needed. This keeps everything in one place.
                    // I think option 2 is the best balance of UX and implementation complexity. I'll create a MapSheet bottom sheet component that can be opened from the activity detail view to select/edit locations without leaving the entry edit context
                    // I already have a Sheet/modal added, but what if I actually made this sheet fully update the url and state so it could be linkable/shareable?
                    // Once I have that, I can next routes inside of sheets, allowing for multistep flows inside modals. This would be great for things like location selection, photo picking, etc.
                    // Right now for ANY sheet the URL is https://localhost:5173/entry#sheet
                    // In the future maybe the URL becomes https://localhost:5173/entry#ACTVITY_ID/detail/map. Then I can deep link directly to that map sheet for that activity detail
                    // This would require some refactoring of how sheets are opened/closed and how state is managed, but it would be a powerful feature
