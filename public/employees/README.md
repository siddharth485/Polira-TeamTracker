# Employee cartoon photos

Drop each person's cartoonised photo here, named by their **employee code**:

```
PR002.png   ← Siddharth
PC001.png   ← Saikat
PR001.png   ← Ranjani
...
```

- These power the **head/face on the 3D figure** in each person's profile (Teams → click a
  card, or the sidebar "my profile"). The kurta/saree body + team colour are generated; the photo
  is mapped onto the face.
- Square, transparent-background PNGs (head-and-shoulders) look best.
- If a photo is missing, the figure simply renders without a face overlay — nothing breaks.
- The path is set per employee in the data as `/employees/<CODE>.png`. To change it, edit the
  employee's `photo` field.
