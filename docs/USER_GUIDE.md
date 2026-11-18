# User guide

## Drawing

Place joints with **J** and connect them with **L**. Clicking two existing joints connects them. Clicking empty space with Link active places endpoints as needed. Share a joint where links should be mechanically connected.

Use **Ground** for a fixed joint, **Slider** for a joint on a stationary straight guide, and **Attach tracer** for a point that remains rigidly attached to a link.

Select an object to inspect its properties. New links can change length while editing. Entering a length enables its length lock; disable **Lock length while editing** to reshape it again. Links remain rigid during motion analysis.

## Constraints

Midpoint, coincident and collinear constraints snap into place when applied and remain active during simulation by default. Alignment and angle relations have a **During simulation** switch: enable it to constrain motion, or leave it off to set only the construction pose.

Angles are measured counterclockwise from the reference to the directed link, from its first joint to its second. The reference may be the positive horizontal axis or another link. Maintaining an absolute angle can conflict with a prescribed rotary input.

An incompatible edit restores the previous drawing. Check ground locations, locked lengths and existing constraints if an edit is rejected.

For **Collinear** (K), select a link and a joint in either order, or select two links. A joint follows the extended line of the link; two links share the same straight line. This permits sliding along the line, so add length or guide constraints when required to determine motion.

Select a link with tracer points to enter each tracer's along-link offset, normal offset, radius from the first joint, or offset angle. Entering a tracer dimension fixes its offsets in length units. Resizing the base link preserves those dimensions; the tracer rotates rigidly with the link.

## Gears

A shaft can be grounded, follow a joint, or have a free centre. Following a joint allows the wheel to spin independently. Use **Attach shaft to link** when the wheel must rotate rigidly with that link.

Automatic fitting attempts to move an editable shaft into pitch contact or resize compatible gears to their shaft spacing. **Fix gear pitch size** protects a wheel from automatic resizing. A fixed module may require a tooth count that cannot fit the requested spacing exactly.

**Lock wheel rotation to ground** holds the wheel's orientation. Shaft support alone only locates its centre. A free centre can leave motion undetermined until more constraints are added.

## Pulleys, belts and ropes

Use **U** or **Pulley** to add a wheel. Select it to set its pitch radius, choose ground or free shaft support, or pick an existing joint to follow. A joint mount locates its centre without fixing its rotation. Attach shaft to link also works with pulleys.

In **Wheel and rope connections**, choose two pulleys and select **Open belt** or **Crossed belt**. Open belts keep the same rotation direction; crossed belts reverse it. Both use equal ideal belt speed, so R1 omega1 = R2 omega2 for an open belt and R1 omega1 = -R2 omega2 for a crossed belt. Angular accelerations follow the same radius ratio. These belt connections require stationary, separated shafts. A pulley radius edit that overlaps its connected wheel is rejected.

**Rope constraint** connects two slider travels with n1 s1 + n2 s2 = constant. Travel is measured along each guide's positive direction. Count the straight segments that change length and enter signed coefficients. Two parallel supporting strands often give a coefficient of 2; reverse the sign for a segment that shortens with positive travel. The differentiated relations determine velocity and acceleration. This describes fixed-direction segments, rather than inferring a cable path from the drawing.

The optional moving wheel assumes a stationary strand on its positive-normal side (90 degrees counterclockwise from its guide direction), giving R theta = s + constant. Use the **Moving pulley** example to inspect the routed two-strand system, including its fixed idler. The example has 2 vC + vE = 0 and 2 aC + aE = 0. With input vE = -40 mm/s and aE = -10 mm/s squared, the moving centre has vC = 20 mm/s and aC = 5 mm/s squared. Its radius is 20 mm, so omega = 1 rad/s and alpha = 0.25 rad/s squared.

Rim-point vectors include centre translation, tangential acceleration and inward normal acceleration. The straight belt's tangential acceleration is distinct from a material point's total acceleration around a curved wheel. Analysis and printed equations include construction steps. Rope tension, loads, friction, slip, elasticity and arbitrary changing rope directions are outside the model.

## Motion and analysis

Choose an input in Motion input, or allow automatic selection. Explicit input selections take precedence. Set the input position, speed and acceleration. Use **Space** to animate or the input slider to inspect individual poses.

Analysis contains polygons, numerical results, equations and motion studies. Velocity and acceleration vectors can also appear on the position diagram. Polygon views have independent zoom controls and component explanations.

Counterclockwise angular rates are positive. Rates use seconds, angular rates use radians, and linear results follow the selected length unit.

## Saving and printing

**Save** writes a mechanism JSON file to your device; **Open** restores one. Drawings are not automatically shared with other visitors. Results and motion-study samples can be exported as CSV.

Print lets you choose diagrams, polygons, results and construction details. Choose a physical scale, match the paper and orientation in the print dialog, use **100% / Actual size**, and disable browser headers and footers. Measure the 50 mm check line before tracing or taking measurements.

## Workspace

Right-drag pans the grid. Left-drag empty grid selects an area. Drag an object with Select active to edit it within its constraints. Escape clears selection and returns to Select. Delete removes selected objects; Ctrl+Z restores an edit.

Properties sections collapse individually. The analysis panel can be resized, retracted to its tabs or closed. The top-bar controls reopen closed panels.
